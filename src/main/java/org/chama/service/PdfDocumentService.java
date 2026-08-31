package org.chama.service;

import jakarta.enterprise.context.ApplicationScoped;
import org.chama.domain.enums.DocumentType;
import org.chama.dto.DocumentLineItemDto;
import org.jboss.logging.Logger;
import org.openpdf.text.Chunk;
import org.openpdf.text.Document;
import org.openpdf.text.DocumentException;
import org.openpdf.text.Element;
import org.openpdf.text.Font;
import org.openpdf.text.Image;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.pdf.BaseFont;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Renders a GeneratedDocument's PDF bytes with OpenPDF. One shared layout covers all three
 * document types (contribution receipt, loan statement, payout receipt), they only differ in
 * title and line items.
 */
@ApplicationScoped
public class PdfDocumentService {

    private static final Logger LOG = Logger.getLogger(PdfDocumentService.class);
    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("d MMMM yyyy");

    private static final float SIDE_MARGIN = 48f;
    private static final float VERTICAL_MARGIN = 56f;

    // The letterhead splits evenly: the chama identifies itself on the left, the document says what
    // it is on the right. Stated here rather than only in header() because the title has to be
    // measured against this width before it can be drawn at a size that fits it.
    private static final float CONTENT_WIDTH = PageSize.A4.getWidth() - 2 * SIDE_MARGIN;
    private static final float TITLE_COLUMN_WIDTH = CONTENT_WIDTH / 2f;

    // Enough slack that a title landing within a hair of the column edge still gets the next size
    // down, rather than fitting on paper and wrapping in a viewer that rounds differently.
    private static final float TITLE_FIT_TOLERANCE = 2f;
    private static final int TITLE_MAX_POINTS = 20;
    private static final int TITLE_MIN_POINTS = 12;

    // The light-theme values of the tokens in frontend/index.css, since a PDF has one appearance.
    // These had drifted: PRIMARY was still the indigo from before the palette moved to kanga teal,
    // so every generated document was printed in a brand colour the product no longer uses.
    private static final Color PRIMARY = new Color(0x1B, 0x4D, 0x45);
    private static final Color INK = new Color(0x1C, 0x24, 0x22);
    private static final Color MUTED = new Color(0x55, 0x65, 0x5F);
    private static final Color PAPER_DIM = new Color(0xEE, 0xF2, 0xF1);

    /**
     * Only ever measured against, never drawn with: the drawn size comes from
     * {@link #titlePointSize}. Deliberately carries no colour, both because metrics do not depend
     * on one and because a static initialiser reading PRIMARY from above would read it as null.
     */
    private static final BaseFont TITLE_BASE_FONT =
        new Font(Font.HELVETICA, TITLE_MAX_POINTS, Font.BOLD).getCalculatedBaseFont(false);
    private static final Font BRAND_FONT = new Font(Font.HELVETICA, 14, Font.BOLD, INK);
    private static final Font LABEL_FONT = new Font(Font.HELVETICA, 9, Font.NORMAL, MUTED);
    private static final Font VALUE_FONT = new Font(Font.HELVETICA, 11, Font.NORMAL, INK);
    private static final Font TABLE_HEADER_FONT = new Font(Font.HELVETICA, 10, Font.BOLD, Color.WHITE);
    private static final Font TABLE_CELL_FONT = new Font(Font.HELVETICA, 10, Font.NORMAL, INK);
    private static final Font TOTAL_FONT = new Font(Font.HELVETICA, 13, Font.BOLD, PRIMARY);
    private static final Font FOOTER_FONT = new Font(Font.HELVETICA, 8, Font.ITALIC, MUTED);

    /**
     * How the issuing chama identifies itself at the top of the document.
     *
     * <p>Every field but the name is optional, and the block collapses around whatever is absent:
     * most chamas that predate these fields have none of them, and plenty of real ones never will.
     */
    public record Letterhead(
        String chamaName,
        String postalAddress,
        String physicalAddress,
        String contactPhone,
        String contactEmail,
        String registrationNumber,
        byte[] logoBytes) {
    }

    public byte[] render(DocumentType type, String documentNumber, Letterhead letterhead, String memberName,
            LocalDate issueDate, List<DocumentLineItemDto> lineItems, BigDecimal totalAmount,
            String billingPeriod, String notes) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try {
            Document document = new Document(PageSize.A4, SIDE_MARGIN, SIDE_MARGIN,
                VERTICAL_MARGIN, VERTICAL_MARGIN);
            PdfWriter.getInstance(document, out);
            document.open();

            document.add(header(letterhead, title(type)));
            document.add(Chunk.NEWLINE);
            document.add(metaTable(documentNumber, issueDate, billingPeriod));
            document.add(Chunk.NEWLINE);
            document.add(recipient(memberName));
            document.add(Chunk.NEWLINE);
            document.add(lineItemsTable(lineItems, totalAmount));

            if (notes != null && !notes.isBlank()) {
                document.add(Chunk.NEWLINE);
                Paragraph notesParagraph = new Paragraph(notes, VALUE_FONT);
                notesParagraph.setSpacingBefore(8);
                document.add(notesParagraph);
            }

            document.add(Chunk.NEWLINE);
            document.add(Chunk.NEWLINE);
            Paragraph footer = new Paragraph("Generated by Webchama, this is a system-generated document.", FOOTER_FONT);
            footer.setAlignment(Element.ALIGN_CENTER);
            document.add(footer);

            document.close();
        } catch (DocumentException e) {
            LOG.error("PDF generation failed for " + documentNumber, e);
            throw new IllegalStateException("PDF generation failed", e);
        }
        return out.toByteArray();
    }

    private String title(DocumentType type) {
        return switch (type) {
            case CONTRIBUTION_RECEIPT -> "CONTRIBUTION RECEIPT";
            case LOAN_STATEMENT -> "LOAN STATEMENT";
            case PAYOUT_RECEIPT -> "PAYOUT RECEIPT";
            case CUSTOM_INVOICE -> "INVOICE";
            case CUSTOM_RECEIPT -> "RECEIPT";
            case AGM_STATEMENT -> "ANNUAL FINANCIAL STATEMENT";
        };
    }

    private PdfPTable header(Letterhead letterhead, String title) throws DocumentException {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{1, 1});

        PdfPCell brandCell = new PdfPCell();
        brandCell.setBorder(0);
        brandCell.setPaddingBottom(6);

        logo(letterhead.logoBytes()).ifPresent(brandCell::addElement);

        Paragraph name = new Paragraph(letterhead.chamaName(), BRAND_FONT);
        name.setSpacingBefore(letterhead.logoBytes() != null ? 4 : 0);
        brandCell.addElement(name);

        for (String line : addressLines(letterhead)) {
            brandCell.addElement(new Paragraph(line, LABEL_FONT));
        }
        table.addCell(brandCell);

        PdfPCell titleCell = new PdfPCell(new Paragraph(title, titleFont(title)));
        titleCell.setBorder(0);
        // The fitter measures against the bare column, so the cell must not then eat into it.
        titleCell.setPadding(0);
        titleCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        table.addCell(titleCell);

        PdfPCell ruleCell = new PdfPCell();
        ruleCell.setColspan(2);
        ruleCell.setFixedHeight(2f);
        ruleCell.setBackgroundColor(PRIMARY);
        ruleCell.setBorder(0);
        table.addCell(ruleCell);

        return table;
    }

    /**
     * The title at the largest size that still sets it on one line.
     *
     * <p>The titles differ in length by a factor of four, from "RECEIPT" to "ANNUAL FINANCIAL
     * STATEMENT", and a fixed size cannot serve both: at a size the longest one fits, the short
     * ones stop reading as a heading. Every title but the longest sets at the full size here, so
     * the shrinking is the exception rather than the rule.
     *
     * <p>Wrapping was the previous behaviour, and it broke "CONTRIBUTION RECEIPT" across two lines
     * on every contribution receipt the product had ever issued.
     */
    static int titlePointSize(String title) {
        float available = TITLE_COLUMN_WIDTH - TITLE_FIT_TOLERANCE;
        for (int points = TITLE_MAX_POINTS; points > TITLE_MIN_POINTS; points--) {
            if (TITLE_BASE_FONT.getWidthPoint(title, points) <= available) {
                return points;
            }
        }
        // Nothing in DocumentType reaches this, and a title long enough to would be unreadable
        // shrunk any further, so it wraps rather than dwindling.
        LOG.warnf("Document title \"%s\" does not fit the letterhead above %dpt, it will wrap",
            title, TITLE_MIN_POINTS);
        return TITLE_MIN_POINTS;
    }

    private static Font titleFont(String title) {
        return new Font(Font.HELVETICA, titlePointSize(title), Font.BOLD, PRIMARY);
    }

    /**
     * The address block, in the order someone would write it on an envelope. Absent fields are
     * skipped rather than rendered blank, so a chama with only a phone number gets one line.
     */
    private static List<String> addressLines(Letterhead letterhead) {
        List<String> lines = new java.util.ArrayList<>();
        addIfPresent(lines, letterhead.postalAddress());
        addIfPresent(lines, letterhead.physicalAddress());

        String contact = Stream.of(letterhead.contactPhone(), letterhead.contactEmail())
            .filter(value -> value != null && !value.isBlank())
            .collect(Collectors.joining("  |  "));
        addIfPresent(lines, contact);

        if (letterhead.registrationNumber() != null && !letterhead.registrationNumber().isBlank()) {
            lines.add("Reg. " + letterhead.registrationNumber());
        }
        return lines;
    }

    private static void addIfPresent(List<String> lines, String value) {
        if (value != null && !value.isBlank()) {
            lines.add(value);
        }
    }

    /**
     * The chama's logo, bounded so a large upload cannot push the rest of the letterhead off the
     * page. A logo that cannot be decoded is dropped rather than failing the whole document: a
     * receipt without a picture is still a receipt.
     */
    private Optional<Image> logo(byte[] bytes) {
        if (bytes == null || bytes.length == 0) {
            return Optional.empty();
        }
        try {
            Image image = Image.getInstance(bytes);
            image.scaleToFit(120f, 44f);
            return Optional.of(image);
        } catch (Exception e) {
            LOG.warnf(e, "Could not render the chama logo onto a document, continuing without it");
            return Optional.empty();
        }
    }

    private PdfPTable metaTable(String documentNumber, LocalDate issueDate, String billingPeriod) {
        PdfPTable table = new PdfPTable(billingPeriod != null ? 3 : 2);
        table.setWidthPercentage(100);

        addMetaCell(table, "DOCUMENT NUMBER", documentNumber);
        addMetaCell(table, "DATE", issueDate.format(DATE_FORMAT));
        if (billingPeriod != null) {
            addMetaCell(table, "PERIOD", billingPeriod);
        }
        return table;
    }

    private void addMetaCell(PdfPTable table, String label, String value) {
        Paragraph paragraph = new Paragraph();
        paragraph.add(new Chunk(label + "\n", LABEL_FONT));
        paragraph.add(new Chunk(value, VALUE_FONT));
        PdfPCell cell = new PdfPCell(paragraph);
        cell.setBorder(0);
        cell.setPaddingBottom(8);
        table.addCell(cell);
    }

    private Paragraph recipient(String memberName) {
        Paragraph paragraph = new Paragraph();
        paragraph.add(new Chunk("ISSUED TO\n", LABEL_FONT));
        paragraph.add(new Chunk(memberName, VALUE_FONT));
        return paragraph;
    }

    private PdfPTable lineItemsTable(List<DocumentLineItemDto> lineItems, BigDecimal totalAmount) {
        PdfPTable table = new PdfPTable(2);
        table.setWidthPercentage(100);
        table.setWidths(new float[]{3, 1});
        table.setSpacingBefore(4);

        table.addCell(headerCell("DESCRIPTION"));
        table.addCell(headerCell("AMOUNT (KES)"));

        for (DocumentLineItemDto item : lineItems) {
            PdfPCell descCell = new PdfPCell(new Paragraph(item.description(), TABLE_CELL_FONT));
            descCell.setPadding(6);
            table.addCell(descCell);

            PdfPCell amountCell = new PdfPCell(new Paragraph(formatAmount(item.amount()), TABLE_CELL_FONT));
            amountCell.setPadding(6);
            amountCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
            table.addCell(amountCell);
        }

        PdfPCell totalLabelCell = new PdfPCell(new Paragraph("TOTAL", TOTAL_FONT));
        totalLabelCell.setBorder(PdfPCell.TOP);
        totalLabelCell.setPadding(6);
        totalLabelCell.setBackgroundColor(PAPER_DIM);
        table.addCell(totalLabelCell);

        PdfPCell totalValueCell = new PdfPCell(new Paragraph(formatAmount(totalAmount), TOTAL_FONT));
        totalValueCell.setBorder(PdfPCell.TOP);
        totalValueCell.setPadding(6);
        totalValueCell.setHorizontalAlignment(Element.ALIGN_RIGHT);
        totalValueCell.setBackgroundColor(PAPER_DIM);
        table.addCell(totalValueCell);

        return table;
    }

    private PdfPCell headerCell(String text) {
        PdfPCell cell = new PdfPCell(new Paragraph(text, TABLE_HEADER_FONT));
        cell.setBackgroundColor(PRIMARY);
        cell.setPadding(6);
        return cell;
    }

    private String formatAmount(BigDecimal amount) {
        return String.format("%,.2f", amount);
    }
}
