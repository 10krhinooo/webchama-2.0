package org.chama.service;

import org.chama.domain.enums.DocumentType;
import org.chama.dto.DocumentLineItemDto;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openpdf.text.pdf.PdfDictionary;
import org.openpdf.text.pdf.PdfName;
import org.openpdf.text.pdf.PdfReader;
import org.openpdf.text.pdf.parser.PdfTextExtractor;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Renders documents and reads them back, rather than only asserting that rendering returned bytes.
 *
 * <p>Written when the PDF engine moved from openpdf 1.3.35 to 3.0.5, a package rename from
 * com.lowagie to org.openpdf. A rename compiles or it does not, but a rendering library can also
 * change what it draws while every call site still compiles, and until this class existed the only
 * evidence that a receipt was still a receipt was that the endpoint answered 201. The engine is a
 * pure function of its arguments, so this needs no Quarkus.
 */
class PdfDocumentServiceTest {

    private final PdfDocumentService service = new PdfDocumentService();

    private static final PdfDocumentService.Letterhead UMOJA = new PdfDocumentService.Letterhead(
        "Umoja Savings",
        "P.O. Box 4021-00100, Nairobi",
        "Biashara Street, Nairobi",
        "254700000001",
        "treasurer@umoja.example",
        "CS/12345",
        null);

    private static final List<DocumentLineItemDto> LINE_ITEMS = List.of(
        new DocumentLineItemDto("March contribution", new BigDecimal("2500.00")),
        new DocumentLineItemDto("Late settlement adjustment", new BigDecimal("120.50")));

    private byte[] render(PdfDocumentService.Letterhead letterhead) {
        return service.render(DocumentType.CONTRIBUTION_RECEIPT, "CR-2026-03-0007", letterhead,
            "Jane Wanjiku", LocalDate.of(2026, 3, 14), LINE_ITEMS, new BigDecimal("2620.50"),
            "March 2026", "Thank you for keeping your contributions current.");
    }

    /** Whether the title occupies one whole line of the page, rather than being broken across two. */
    private static boolean setsOnOneLine(byte[] pdf, String title) throws IOException {
        return textOf(pdf).lines().map(String::trim).anyMatch(line -> line.equals(title));
    }

    private static String textOf(byte[] pdf) throws IOException {
        PdfReader reader = new PdfReader(pdf);
        try {
            assertEquals(1, reader.getNumberOfPages(), "the sample document should fit one page");
            return new PdfTextExtractor(reader).getTextFromPage(1);
        } finally {
            reader.close();
        }
    }

    @Test
    void producesAFileAPdfReaderAccepts() throws IOException {
        byte[] pdf = render(UMOJA);

        assertTrue(new String(pdf, 0, 5, StandardCharsets.ISO_8859_1).equals("%PDF-"),
            "should carry the PDF magic header");
        assertEquals(1, new PdfReader(pdf).getNumberOfPages());
    }

    @Test
    void drawsTheIssuingChamaOntoTheLetterhead() throws IOException {
        String text = textOf(render(UMOJA));

        // Every one of these is a field the chama entered about itself. A receipt that carries none
        // of them is indistinguishable from one issued by any other chama, which is the whole
        // reason the letterhead exists.
        assertTrue(text.contains("Umoja Savings"), text);
        assertTrue(text.contains("P.O. Box 4021-00100, Nairobi"), text);
        assertTrue(text.contains("Biashara Street, Nairobi"), text);
        assertTrue(text.contains("254700000001"), text);
        assertTrue(text.contains("treasurer@umoja.example"), text);
        assertTrue(text.contains("Reg. CS/12345"), text);
    }

    @Test
    void drawsTheRecordTheDocumentIsAbout() throws IOException {
        String text = textOf(render(UMOJA));

        assertTrue(text.contains("CONTRIBUTION RECEIPT"), text);
        assertTrue(text.contains("CR-2026-03-0007"), text);
        assertTrue(text.contains("14 March 2026"), text);
        assertTrue(text.contains("March 2026"), text);
        assertTrue(text.contains("Jane Wanjiku"), text);
        assertTrue(text.contains("March contribution"), text);
        assertTrue(text.contains("Late settlement adjustment"), text);
        assertTrue(text.contains("Thank you for keeping your contributions current."), text);
    }

    @Test
    void groupsTheDigitsOfEveryAmountSoALargeFigureStaysReadable() throws IOException {
        byte[] pdf = service.render(DocumentType.PAYOUT_RECEIPT, "PR-2026-03-0001", UMOJA,
            "Jane Wanjiku", LocalDate.of(2026, 3, 14),
            List.of(new DocumentLineItemDto("Payout, turn 4", new BigDecimal("1250000"))),
            new BigDecimal("1250000"), null, null);

        String text = textOf(pdf);
        assertTrue(text.contains("1,250,000.00"), text);
    }

    @Test
    void collapsesTheAddressBlockAroundWhateverTheChamaHasNotFilledIn() throws IOException {
        // Every chama that predates the profile fields is in exactly this state.
        String text = textOf(render(new PdfDocumentService.Letterhead(
            "Hazina Trust", null, null, null, null, null, null)));

        assertTrue(text.contains("Hazina Trust"), text);
        assertFalse(text.contains("Reg."), "an absent registration number should draw no label");
        assertFalse(text.contains("null"), "an absent field should be skipped, never printed");
        assertFalse(text.contains("|"), "the phone/email separator needs both sides to appear");
    }

    @Test
    void joinsPhoneAndEmailOnOneLineOnlyWhenItHasBoth() throws IOException {
        String phoneOnly = textOf(render(new PdfDocumentService.Letterhead(
            "Hazina Trust", null, null, "254700000002", null, null, null)));

        assertTrue(phoneOnly.contains("254700000002"), phoneOnly);
        assertFalse(phoneOnly.contains("|"), phoneOnly);
    }

    @ParameterizedTest
    @CsvSource({
        "CONTRIBUTION_RECEIPT, CONTRIBUTION RECEIPT",
        "LOAN_STATEMENT, LOAN STATEMENT",
        "PAYOUT_RECEIPT, PAYOUT RECEIPT",
        "CUSTOM_INVOICE, INVOICE",
        "CUSTOM_RECEIPT, RECEIPT",
        "AGM_STATEMENT, ANNUAL FINANCIAL STATEMENT",
    })
    void titlesEachDocumentTypeAsItsOwnKindOfDocument(DocumentType type, String expectedTitle)
            throws IOException {
        byte[] pdf = service.render(type, "X-0001", UMOJA, "Jane Wanjiku",
            LocalDate.of(2026, 3, 14), LINE_ITEMS, new BigDecimal("2620.50"), null, null);

        // On one line, not merely present. "CONTRIBUTION RECEIPT" used to break after the first
        // word on every contribution receipt the product issued, and a contains() check on the
        // whole page reads as green either way.
        assertTrue(setsOnOneLine(pdf, expectedTitle),
            expectedTitle + " should set on one line, page was:\n" + textOf(pdf));
    }

    @Test
    void keepsTheLongestTitleOnOneLineByShrinkingOnlyThatOne() {
        // The titles differ in length by a factor of four. Sizing them all for the longest would
        // leave "RECEIPT" too small to read as a heading, so only what does not fit gives way.
        assertEquals(20, PdfDocumentService.titlePointSize("RECEIPT"));
        assertEquals(20, PdfDocumentService.titlePointSize("INVOICE"));
        assertEquals(20, PdfDocumentService.titlePointSize("LOAN STATEMENT"));
        assertEquals(20, PdfDocumentService.titlePointSize("PAYOUT RECEIPT"));
        assertEquals(20, PdfDocumentService.titlePointSize("CONTRIBUTION RECEIPT"));

        int agm = PdfDocumentService.titlePointSize("ANNUAL FINANCIAL STATEMENT");
        assertTrue(agm < 20 && agm >= 12, "the longest title should shrink, not wrap: " + agm);
    }

    @Test
    void stopsShrinkingRatherThanDwindlingToNothing() {
        // A title nothing in DocumentType can produce. It wraps, which is the better of two bad
        // outcomes: the alternative is a heading too small to read.
        assertEquals(12, PdfDocumentService.titlePointSize("ANNUAL FINANCIAL STATEMENT AND "
            + "REPORT OF THE MANAGEMENT COMMITTEE TO THE MEMBERS IN GENERAL MEETING"));
    }

    @Test
    void embedsTheChamaLogoWhenOneHasBeenUploaded() throws IOException {
        byte[] withLogo = render(withLogo(pngBytes()));
        byte[] withoutLogo = render(UMOJA);

        assertNotNull(firstPageImages(withLogo), "the page should carry an image XObject");
        assertTrue(withLogo.length > withoutLogo.length,
            "a document carrying a logo should be larger than the same document without one");
    }

    @Test
    void dropsALogoItCannotDecodeRatherThanFailingTheWholeDocument() throws IOException {
        // A receipt without a picture is still a receipt, and the member asking for it has done
        // nothing wrong. Failing here would make one bad upload block every document a chama issues.
        String text = textOf(render(withLogo("this is not an image".getBytes(StandardCharsets.UTF_8))));

        assertTrue(text.contains("Umoja Savings"), text);
        assertTrue(text.contains("CR-2026-03-0007"), text);
    }

    private static PdfDocumentService.Letterhead withLogo(byte[] logo) {
        return new PdfDocumentService.Letterhead(UMOJA.chamaName(), UMOJA.postalAddress(),
            UMOJA.physicalAddress(), UMOJA.contactPhone(), UMOJA.contactEmail(),
            UMOJA.registrationNumber(), logo);
    }

    private static PdfDictionary firstPageImages(byte[] pdf) throws IOException {
        PdfReader reader = new PdfReader(pdf);
        try {
            PdfDictionary resources = reader.getPageN(1).getAsDict(PdfName.RESOURCES);
            return resources == null ? null : resources.getAsDict(PdfName.XOBJECT);
        } finally {
            reader.close();
        }
    }

    private static byte[] pngBytes() throws IOException {
        BufferedImage image = new BufferedImage(64, 24, BufferedImage.TYPE_INT_RGB);
        image.createGraphics().drawRect(0, 0, 64, 24);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
