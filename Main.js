require('dotenv').config();
const { Client } = require('@notionhq/client');

const UpdateCurrencyTable = require('./CurrencyTableUpdater');
const ProfitAndLossTableUpdater = require('./ProfitAndLossViewUpdater');


const { NotionDataReader } = require('./src/Statics')

async function Main()
{
    const notion = new Client({ auth: process.env.NOTION_SECRET_KEY });

    try
    {
        //Class Instance creation
        const PL = new ProfitAndLossTableUpdater();


        if(process.env.UPDATE_CURRENCY_TABLE == 1)
            await UpdateCurrencyTable(notion);
        
        if(process.env.UPDATE_PL_TABLE == 1)
            await PL.UpdatePLTable(notion);

    }catch(err)
    {
        console.log(err);
    }
}

Main();