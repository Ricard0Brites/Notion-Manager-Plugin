require('dotenv').config();
require('./CryptoFetch.js');
const { Client } = require('@notionhq/client');
const MakeCurrencyTableEntryLiteral = require('./Table_Formats/CurrencyTableFormat.js');
const { SingleTextField, SingleSelectField, NumberField } = require('./DataTypes.js');
const { UpdatePage } = require("./Statics.js");
const CryptoDataFetcher = require("./CryptoFetch.js");

const FIATTableSymbol = "FIAT";
const CryptoTableSymbol = "Crypto";

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_SECRET_KEY });
(
async () => 
{
    try 
    {
        //#region Crypto

            //#region Query Crypto Values in the provided Database
            const CryptoResponse = await notion.databases.query
            ({
                database_id: process.env.CRYPTO_DATABASE_ID,
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
            if (process.env.RUN_CRYPTO_FETCH === '1') 
            {
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
            }

            //#endregion

            //#region Populates the table with the updated information
            // Symbols found In Notion: CryptoSymbolsToLookFor type: Object {Symbol, Data}

           //#region Example CryptoData Entry
           /*
            [
                { BTC: [Object] },
                { USDT: [Object] },
                { USDC: [Object] }
            ]   

            {
                id: 1,
                name: 'Bitcoin',
                symbol: 'BTC',
                slug: 'bitcoin',
                num_market_pairs: 12207,
                date_added: '2010-07-13T00:00:00.000Z',
                tags: [
                    'mineable',
                    'pow',
                    'sha-256',
                    'store-of-value',
                    'state-channel',
                    'coinbase-ventures-portfolio',
                    'three-arrows-capital-portfolio',
                    'polychain-capital-portfolio',
                    'binance-labs-portfolio',
                    'blockchain-capital-portfolio',
                    'boostvc-portfolio',
                    'cms-holdings-portfolio',
                    'dcg-portfolio',
                    'dragonfly-capital-portfolio',
                    'electric-capital-portfolio',
                    'fabric-ventures-portfolio',
                    'framework-ventures-portfolio',
                    'galaxy-digital-portfolio',
                    'huobi-capital-portfolio',
                    'alameda-research-portfolio',
                    'a16z-portfolio',
                    '1confirmation-portfolio',
                    'winklevoss-capital-portfolio',
                    'usv-portfolio',
                    'placeholder-ventures-portfolio',
                    'pantera-capital-portfolio',
                    'multicoin-capital-portfolio',
                    'paradigm-portfolio',
                    'bitcoin-ecosystem',
                    'layer-1',
                    'ftx-bankruptcy-estate',
                    '2017-2018-alt-season',
                    'us-strategic-crypto-reserve',
                    'binance-ecosystem'
                ],
                max_supply: 21000000,
                circulating_supply: 19873743,
                total_supply: 19873743,
                infinite_supply: false,
                platform: null,
                cmc_rank: 1,
                self_reported_circulating_supply: null,
                self_reported_market_cap: null,
                tvl_ratio: null,
                last_updated: '2025-06-03T05:18:00.000Z',
                quote: {
                    USD: {
                    price: 105407.40068926047,
                    volume_24h: 47036279246.72889,
                    volume_change_24h: 25.535,
                    percent_change_1h: 0.04530314,
                    percent_change_24h: 0.46025959,
                    percent_change_7d: -3.02189583,
                    percent_change_30d: 9.98376059,
                    percent_change_60d: 27.22340225,
                    percent_change_90d: 21.22721526,
                    market_cap: 2094839591596.3853,
                    market_cap_dominance: 63.2075,
                    fully_diluted_market_cap: 2213555414474.47,
                    tvl: null,
                    last_updated: '2025-06-03T05:18:00.000Z'
                    }
                }
            }
            */
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
                    UpdatePage(notion, PageID, UpdatedEntry);
                }
            }
            //#endregion
        
        //#endregion Crypto
    } 
    catch (error) 
    {
        if(process.env.LOG == 1)
            console.error('Error connecting to Notion API:', error.message);
    }
})();
