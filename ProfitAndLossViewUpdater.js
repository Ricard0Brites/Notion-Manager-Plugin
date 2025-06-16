const { UpdatePage, ApplicationStatics } = require("./src/Statics.js");
const { SingleTextField, SingleSelectField, NumberField } = require('./src/DataTypes.js');
const { default: axios } = require('axios');

async function UpdatePLView(notion)
{
    if(notion == null)
        return;

    //these types 
    const EInvestmentSummaryType =
    {
        Open: 'Open',
        Closed: 'Closed',
        Total: 'Total',
        ROI: 'ROI'
    };

    try
    {
        var CurrencyData = ApplicationStatics.GetCurrencyData();


        //#region Get Database From Notion
        const NotionResponse_PL = await notion.databases.query
        ({
            database_id: process.env.PL_DATABASE_ID,
        });

        const NotionResponse_Investments = await notion.databases.query
        ({
            database_id: process.env.INVESTMENTS_TABLE_ID,
        });
        //#endregion
        //#region Raw Data Manipulation
            var OrganizedData = {};
            var Keys = Object.keys(EInvestmentSummaryType);
            for(type of Keys)
            {
                OrganizedData[type] = {Data:[], Value:0};
            }
            //{ Open: [Data: [], Value = 0], Closed: [Data: [], Value = 0]}
            
            for(Entry of NotionResponse_Investments.results)
            {
                //#region Open Positions
                {
                    const Category = EInvestmentSummaryType.Open;
                    if(Entry.properties.Status.status.name === Category)
                    {
                        const Page_ID = Entry.properties.Investment.relation[0].id;

                        const Response = await axios.get(`https://api.notion.com/v1/pages/${Page_ID}`, 
                       {
                          headers: 
                          {
                            'Authorization': `Bearer ${process.env.NOTION_SECRET_KEY}`,
                            'Notion-Version': process.env.NOTION_VERSION,
                            'Content-Type': 'application/json'
                          }
                       });

                        const Symbol = Response.data.properties.Symbol.select.name;
                        const OpenValue = CurrencyData[Symbol];
                        const BuyValue = Entry.properties['Buy Price'].number;
                        const Fee = Entry.properties.Fees.number;
                        const ROI = ((OpenValue - Fee) / BuyValue) - 1;
                        const InvestmentAmount = Entry.properties['Investment Amount'].number;

                        console.log(Fee);
                        OrganizedData[Category].Value += (ROI * InvestmentAmount);
                        OrganizedData[Category].Data.push(Entry);
                    }
                }
                //#endregion

                //#region Closed Positions
                {
                    const Category = EInvestmentSummaryType.Closed;
                    if(Entry.properties.Status.status.name === Category)
                    {
                        const ROI = (Entry.properties['Sell Price'].number / Entry.properties['Buy Price'].number) - 1;
                        const InvestmentAmount = Entry.properties['Investment Amount'].number;

                        OrganizedData[Category].Value += (ROI * InvestmentAmount);
                        OrganizedData[Category].Data.push(Entry);
                    }
                }
                //#endregion
            }

            //#region Total Invested
            var TotalInvested = 0;
            {
                for(var Investment of NotionResponse_Investments.results)
                {
                    TotalInvested += Investment.properties['Investment Amount'].number;
                }
            }
            //#endregion

            //#region ROI
            {
                var ROI = 0;
                var CumulativeInvestment = 0, CumulativeReturn = 0, CumulativeFees = 0;
                for(var Position of OrganizedData.Closed.Data)
                {
                    var SellPrice = Position.properties['Sell Price'].number;
                    var BuyPrice = Position.properties['Buy Price'].number;
                    
                    if(BuyPrice == null || SellPrice == null)
                    {
                        if(process.env.log == 1)
                        {
                            console.log('------------------');
                            console.log('Error: Buy or Sell price is null. please populate both these fields in the database id: ' + Position.url);
                            console.log('Buy Price = ' + BuyPrice);
                            console.log('Sell Price = ' + SellPrice);
                        }
                        continue;
                    }

                    CumulativeInvestment += BuyPrice;
                    CumulativeReturn += SellPrice;
                    CumulativeFees += Position.properties.Fees.number;
                }

                for(var Position of OrganizedData.Open.Data)
                {
                    var BuyPrice = Position.properties['Buy Price'].number;
                    
                    //Get Investment Symbol From Relation Field
                    const Page_ID = Entry.properties.Investment.relation[0].id;
                    const Response = await axios.get(`https://api.notion.com/v1/pages/${Page_ID}`, 
                    {
                        headers: 
                        {
                        'Authorization': `Bearer ${process.env.NOTION_SECRET_KEY}`,
                        'Notion-Version': process.env.NOTION_VERSION,
                        'Content-Type': 'application/json'
                        }
                    });

                    var SellPrice = CurrencyData[Response.data.properties.Symbol.select.name];

                    if(BuyPrice == null || SellPrice == null)
                    {
                        if(process.env.log == 1)
                        {
                            console.log('------------------');
                            console.log('Error: Buy or Sell price is null. please populate both these fields in the database id: ' + Position.url);
                            console.log('Buy Price = ' + BuyPrice);
                            console.log('Sell Price = ' + SellPrice);
                        }
                        continue;
                    }

                    CumulativeInvestment += BuyPrice;
                    CumulativeReturn += SellPrice;
                    CumulativeFees += Position.properties.Fees.number;
                }
                if(CumulativeInvestment != 0)
                    ROI = ((CumulativeReturn - CumulativeFees) / CumulativeInvestment) - 1;
                
                if(process.env.log == 1)
                {
                    console.log('ROI = ' + ROI * 100 + '% ' + '(' + ROI + ')');
                    console.log('P&L = ' + TotalInvested * ROI);
                }
            }
            //#endregion
        //#endregion
        //#region Populate Info Table
        for(TableEntry of NotionResponse_PL.results)
        {
            const Description = Object.keys(TableEntry.properties).reverse()[0];
            const Value = Object.keys(TableEntry.properties).reverse()[2];
            const Code = Object.keys(TableEntry.properties).reverse()[1];
            var UpdatedValue = 0;

            switch(TableEntry.properties[Code].select.name)
            {
                case EInvestmentSummaryType.Open:
                    UpdatedValue += OrganizedData.Open.Value;
                    break;

                case EInvestmentSummaryType.Closed:
                    UpdatedValue = OrganizedData.Closed.Value;
                    break;
                
                case EInvestmentSummaryType.Total:
                    UpdatedValue = TotalInvested;
                    break;

                case EInvestmentSummaryType.ROI:
                    UpdatedValue = ROI;
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

module.exports = UpdatePLView;