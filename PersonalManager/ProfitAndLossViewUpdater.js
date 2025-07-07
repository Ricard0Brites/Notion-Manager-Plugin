const { UpdatePage, ApplicationStatics, NotionDataReader, RequestDatabase } = require("./src/Statics.js");
const { SingleTextField, SingleSelectField, NumberField } = require('./src/DataTypes.js');
const { default: axios } = require('axios');


//Important Notice: any Open P&L values calculated are not ajusted to sale fees. These values should be manually inserted by the user
//                  when the investment state changes (From 'Open' to 'Closed').

class ProfitAndLossTableUpdater
{
    //#region Data Types
    #EInvestmentSummaryType =
    {
        // these are fields in the table we want to populate information into
       Open: 'Open',Closed: 'Closed',Total: 'Total',ROI: 'ROI'
    }
    //#endregion

    //#region Raw Data
    Q_OpenPositions = [];
    Q_ClosedPositions = [];
    //#endregion

    //#region Sanitized Data
    
    //Keeps The total value for the profit or Loss of open positions based on realtime investment values
    //Format: {Value: 1000, Entries: [Page1, Page2, Page3], Symbol[BTC, USDC, BTC]}
    //Pages refer to the response from notion. this information is kept to avoid API requests Later on
    #OpenPositionsPL = {};
    
    //Keeps The total value for the profit or Loss of Closed positions based on Buy and Sell Price of said investment
    //Format: {Value: 1000, Entries: [Page1, Page2, Page3]}
    //Pages refer to the response from notion. this information is kept to avoid API requests Later on
    #ClosedPositionsPL = {};

    //Keeps information about currency Symbols (GBP, USD, EUR, etc...) and their realtime values
    //Format { EUR: 1, USD:1 }
    #_CurrencyData = {};

    //#endregion

    //#region Wrappers
    #GetROI()
    {
        var TotalInvested = 0;
        const ROI = (this.#GetOpenPL() + this.#GetClosedPL());
        const AllInvestments = [...this.#OpenPositionsPL.Entries, ...this.#ClosedPositionsPL.Entries];

        for(var InvestmentEntry of AllInvestments)
        {
            TotalInvested += NotionDataReader.GetDataFromNumberField(InvestmentEntry.properties['Investment Amount']);
        }
        return ROI / TotalInvested; //This turns Raw ROI values into percentages
    }

    #GetTotalInvested()
    {
        if(this.#OpenPositionsPL.Entries.length <= 0)
            return 0;

        var TotalInvested = 0;

        for(var Investment of this.#OpenPositionsPL.Entries)
        {
             const Fee = NotionDataReader.GetDataFromNumberField(Investment.properties.Fees);
             TotalInvested += (NotionDataReader.GetDataFromNumberField(Investment.properties['Investment Amount']) - Fee);
        }
        return TotalInvested;
    }

    #GetOpenPL()
    {
        return this.#OpenPositionsPL.Value;
    }

    #GetClosedPL()
    {
        return this.#ClosedPositionsPL.Value
    }
    //#endregion

    //#region Queue Handlers
    async #HandleOpenPositionQueue()
    {
        if(this.Q_OpenPositions.length <= 0 )
            return;

        var ReturnValue = {Value:0, Entries: [], Symbol:[]};

        for(var OpenPosition of this.Q_OpenPositions)
        {
            const Page_ID = OpenPosition.properties.Investment; // Current Database Entry ID
            const RelationData = await NotionDataReader.GetDataFromRelationField(Page_ID); // Get Page This Relation field relates to
            const Symbol = NotionDataReader.GetDataFromSingleSelectField(RelationData[0].properties.Symbol); // Get the symbol of the investment (to get its' live price)
            const OpenValue = this.CurrencyData[Symbol];
            const BuyValue = NotionDataReader.GetDataFromNumberField(OpenPosition.properties['Buy Price']);
            const Fee = NotionDataReader.GetDataFromNumberField(OpenPosition.properties.Fees);
            const RawInvestmentAmount = NotionDataReader.GetDataFromNumberField(OpenPosition.properties['Investment Amount']);

            //Calculations
            const ROI = (OpenValue / BuyValue) - 1;
            const LiquidInvestmentAmount = RawInvestmentAmount - Fee;
            const InvestmentPL = LiquidInvestmentAmount * ROI;

            //Sanitized Data Cache
            ReturnValue.Value += InvestmentPL;
            ReturnValue.Entries.push(OpenPosition);
            ReturnValue.Symbol.push(Symbol);
        }

        


        this.Q_OpenPositions = [];
        
        return ReturnValue;
    }

    #HandleClosedPositionQueue()
    {
        var ReturnValue = {Value:0, Entries:[]};
        for(var ClosedPosition of this.Q_ClosedPositions)
        {
            const SellPrice =  NotionDataReader.GetDataFromNumberField(ClosedPosition.properties['Sell Price']);
            const BuyPrice = NotionDataReader.GetDataFromNumberField(ClosedPosition.properties['Buy Price']);
            const RawInvestmentAmount = NotionDataReader.GetDataFromNumberField(ClosedPosition.properties['Investment Amount']);
            const Fee = NotionDataReader.GetDataFromNumberField(ClosedPosition.properties.Fees);

            //Calculations
            const ROI = (SellPrice / BuyPrice) - 1;
            const LiquidInvestmentAmount = RawInvestmentAmount - Fee;

            //Sanitized Data Cache
            ReturnValue.Value += (ROI * LiquidInvestmentAmount);
            ReturnValue.Entries.push(ClosedPosition);
        }
        this.Q_ClosedPositions = [];
        
        return ReturnValue;
    }
    //#endregion

    async UpdatePLTable(notion)
    {
        if(process.env.ENABLE_FIAT !=1 )
            return;

        if(notion == null)
            return;


        //Contains Updated Currency Values (Script that updates the currency table is REQUIRED to run BEFORE this one, otherwise the values will NOT be present)
        this.CurrencyData = ApplicationStatics.GetCurrencyData();

        try
        {
            //#region Get Database From Notion

            const NotionResponse_PL = await RequestDatabase(notion, process.env.PL_DATABASE_ID);
            
            const NotionResponse_Investments = await RequestDatabase(notion, process.env.INVESTMENTS_TABLE_ID);
            
            //#endregion         

            //Fill Queues
            for(var Entry of NotionResponse_Investments.results)
            {
                if(Entry.properties.Status.status.name === 'Open')
                {
                    this.Q_OpenPositions.push(Entry);
                }
                else if(Entry.properties.Status.status.name === 'Closed')
                {
                    this.Q_ClosedPositions.push(Entry);
                }
                else
                {
                    if(process.env.log == 1)
                    {
                        console.log(__filename + ' Found Unrecognized Investment Entry Type: ' + Entry.properties.Status.status.name);
                    }
                }
            }

            //Handle Queues (This approach has been adopted only for code readability and debuggability with expansion in mind)
            this.#OpenPositionsPL = await this.#HandleOpenPositionQueue();
            this.#ClosedPositionsPL = this.#HandleClosedPositionQueue();

            //#region Push Data to Notion
            for(var TableEntry of NotionResponse_PL.results)
            {
                const Description = Object.keys(TableEntry.properties).reverse()[0];
                const Value = Object.keys(TableEntry.properties).reverse()[2];
                const Code = Object.keys(TableEntry.properties).reverse()[1];
                var UpdatedValue = 0;

                switch(NotionDataReader.GetDataFromSingleSelectField(TableEntry.properties[Code]))
                {
                    case this.#EInvestmentSummaryType.Open:
                        UpdatedValue = this.#GetOpenPL();
                        break;

                    case this.#EInvestmentSummaryType.Closed:
                        UpdatedValue = this.#GetClosedPL();
                        break;
                
                    case this.#EInvestmentSummaryType.Total:
                        UpdatedValue = this.#GetTotalInvested();
                        break;

                    case this.#EInvestmentSummaryType.ROI:
                        UpdatedValue = this.#GetROI();
                        break;
                };

                const UpdateBody = 
                {
                    ...SingleTextField(Description, TableEntry.properties[Description].title[0].plain_text),
                    ...NumberField(Value, UpdatedValue),
                    ...SingleSelectField(Code, TableEntry.properties[Code].select.name)
                };

                if(process.env.log == 1)
                    console.log(UpdateBody);

               await UpdatePage(notion, TableEntry.id, UpdateBody); 
            }
            //#endregion
        }
        catch(error)
        {
            console.log(error);
        }
    }
}

module.exports = ProfitAndLossTableUpdater;