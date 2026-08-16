@cds.external
service ExchangeRateService {

    @readonly
    entity Rates {
        key baseCurrency  : String(3);
        key quoteCurrency : String(3);
        key rateDate      : Date;

        rate : Decimal(18,6) not null;
    }
}