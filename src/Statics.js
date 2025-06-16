require('dotenv').config();

async function UpdatePage(notion, PageID, Update) 
{
    MaxRetryAmount = 20;
    try
    {        
        await notion.pages.update
        (
            {
                page_id: PageID,
                properties: Update
            }
        );

        console.log(Update);
    } catch (err)
    {
        //await new Promise(r => setTimeout(r, 500));
        console.log(err);
    } 

}


class ApplicationStatics
{
    //Currency Data
    static CurrencyData = {};

    static SetCurrencyData(NewData) { this.CurrencyData = NewData; }
    static GetCurrencyData() 
    {
        if(process.env.ENABLE_CRYPTO == 1 && process.env.ENABLE_FIAT == 1)
            return this.CurrencyData;

        var DebugObject = 
        {
            USDC: 1,
            BTC: 150000,
            EUR: 0.86866,
            USD: 1,
            CAD: 1.3629,
            AUD: 1.5442,
            JPY: 144.15,
            GBP: 0.73879
        };

        return DebugObject;
    }


}

module.exports = {UpdatePage, ApplicationStatics};
