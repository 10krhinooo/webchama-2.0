package org.chama.dto;

import org.chama.domain.model.WelfareFund;

import java.math.BigDecimal;

public record WelfareFundDto(Long chamaId, BigDecimal balance) {

    public static WelfareFundDto from(WelfareFund fund) {
        return new WelfareFundDto(fund.chama.id, fund.balance);
    }
}
