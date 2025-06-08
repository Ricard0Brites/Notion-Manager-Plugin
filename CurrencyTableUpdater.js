require('dotenv').config();
const { Client } = require('@notionhq/client');
const MakeCurrencyTableEntryLiteral = require('./src/Table_Formats/CurrencyTableFormat.js');
const { SingleTextField, SingleSelectField, NumberField } = require('./src/DataTypes.js');
const { UpdatePage } = require("./src/Statics.js");
const CryptoDataFetcher = require("./src/CryptoFetch.js");
const { default: axios } = require('axios');

//#region FIAT Init Data
const FIATTableSymbol = 'FIAT';
const FIAT_API_Link = 'https://api.frankfurter.app/latest';
const FIAT_API_FullName_Link = 'https://api.frankfurter.dev/v1/currencies'
const REFERENCE_CURRENCY = 'USD'; //TODO - Get This Dynamically?
//#endregion

//#region Crypto Init Data
const CryptoTableSymbol = 'Crypto';
//#endregion

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_SECRET_KEY });
(
async () => 
{
    try 
    {
        if(process.env.ENABLE_CRYPTO == 1)
        {
            //#region Crypto

                //#region Query Crypto Values in the provided Database
                const CryptoResponse = await notion.databases.query
                ({
                    database_id: process.env.DATABASE_ID,
                    filter: 
                    {
                        property: 'Category',
                        select: {equals: CryptoTableSymbol}
                    }
                });
                //#endregion

                //#region Extract the symbols from the result query
                const CryptoSymbolsToLookFor = [];
                for(Entry of CryptoResponse.results)
                {
                    const SymbolToAdd = Entry.properties.Symbol.select.name;
                    CryptoSymbolsToLookFor.push({Symbol : SymbolToAdd, Data: Entry});
                    if(process.env.LOG == 1)
                        console.log('Found Symbol In Crypto Table: %s', SymbolToAdd);
                }
                //#endregion

                //#region Fetch Crypto data from CMC
                CryptoData = [];

                if(process.env.LOG == 1)
                    console.log('Attempting To Fetch Crypto Data -------------------------');
                
                //Make a list of just the symbols
                SymbolList = [];
                for(symbol of CryptoSymbolsToLookFor)
                {
                    SymbolList.push(symbol.Symbol);
                }

                const cryptoFetcher = new CryptoDataFetcher(process.env.CMC_SECRET_KEY, SymbolList);
                CryptoData = await cryptoFetcher.FetchData();

                if(process.env.LOG == 1)
                    console.log('Crypto Data End-------------------------------------');

                //#endregion

                //#region Populates the table with the updated information
                // Symbols found In Notion: CryptoSymbolsToLookFor type: Object {Symbol, Data}
            
            //#endregion
                
            for(SymbolInNotion in CryptoSymbolsToLookFor)
                {
                    /* These variables are data we reference off of so they should NEVER change */
                    const Symbol = CryptoSymbolsToLookFor[SymbolInNotion].Symbol;
                    const Category = CryptoSymbolsToLookFor[SymbolInNotion].Data.properties.Category.select.name;
                    const PageID = CryptoSymbolsToLookFor[SymbolInNotion].Data.id;
                    //These Values Are Dynamic 
                    NewLongName = "";
                    NewValue = -1;

                    for(Index of CryptoData)
                    {
                        const Key = Object.keys(Index)[0]; // this only has one value, always.
                        if(Key === Symbol)
                        {
                            NewLongName = Index[Key].slug;
                            NewValue = Index[Key].quote.USD.price;
                        }
                    }

                    if( CryptoData.length > 0 )
                    {
                        //Gets the values of the table fields
                        const Keys = Object.keys(CryptoSymbolsToLookFor[SymbolInNotion].Data.properties).reverse();

                        const UpdatedEntry = MakeCurrencyTableEntryLiteral
                        (
                            SingleTextField(Keys[0], NewLongName), // long name
                            SingleSelectField(Keys[1], Symbol), // symbol
                            SingleSelectField(Keys[2], Category),// category
                            NumberField(Keys[3], NewValue) // Value
                        );
                        if(process.env.LOG == true)
                            console.log(UpdatedEntry);

                        console.log(UpdatedEntry);

                       await UpdatePage(notion, PageID, UpdatedEntry);
                    }
                }
                //#endregion
            //#endregion Crypto
        }
            

        if(process.env.ENABLE_FIAT == 1)
        {
            //#region Query FIAT Values in the provided Database In Notion
            const FIATResponse = await notion.databases.query
            ({
                database_id: process.env.DATABASE_ID,
                filter: 
                {
                    property: 'Category',
                    select: {equals: FIATTableSymbol}
                }
            });
            //#endregion
            const FIAT_Rates = await axios.get(FIAT_API_Link, 
            {
                params:
                {
                    base: REFERENCE_CURRENCY
                }
            });
            const FIAT_FullNames = await axios.get(FIAT_API_FullName_Link);
            //#endregion

            for(PageData of FIATResponse.results)
            {
                //Params
                var PageID, Symbol, LongName, Category, Value;

                NotionTableColumnNames = Object.keys(PageData.properties).reverse();
                //Get Page ID (From Notion)
                PageID = PageData.id;
                
                //Get Symbol (From Notion Table)
                if(NotionTableColumnNames.length <= 0 && process.env.LOG == 1)
                    console.log('Failed Notion Table Column Fetch Attempt.');
                
                Symbol = PageData.properties[NotionTableColumnNames[1]].select.name;

                //Get Long Name (From API Using Symbol)
                if(!FIAT_FullNames.data[Symbol] && process.env.LOG == 1)
                    console.log('Failed To Get Long Name From FIAT API With Symbol: ' + Symbol);
                
                LongName = FIAT_FullNames.data[Symbol];

                //Get Value (From API Using Symbol)
                if(Symbol === REFERENCE_CURRENCY)
                {
                    Value = 1;
                }
                else
                {
                    if(!FIAT_Rates.data.rates[Symbol] && process.env.LOG == 1)
                    console.log('Failed To Get Value From FIAT API With Symbol: ' + Symbol);
                
                    Value = Number(FIAT_Rates.data.rates[Symbol]);
                }

                //Get Category
                if(NotionTableColumnNames.length <= 0 && process.env.LOG == 1)
                    console.log('Failed Notion Table Column Fetch Attempt.');
                
                Category = PageData.properties[NotionTableColumnNames[2]].select.name;
             
                const UpdatedEntry = MakeCurrencyTableEntryLiteral
                (
                    SingleTextField(NotionTableColumnNames[0], LongName), // long name
                    SingleSelectField(NotionTableColumnNames[1], Symbol), // symbol
                    SingleSelectField(NotionTableColumnNames[2], Category), // category
                    NumberField(NotionTableColumnNames[3], Value) // Value
                );

                await UpdatePage(notion, PageID, UpdatedEntry);
            }
            
        //#endregion   
        }
    } 
    catch (error) 
    {
        if(process.env.LOG == 1)
            console.error('Error connecting to Notion API:', error.message);
    }
})();
