require('dotenv').config();
const { Client } = require('@notionhq/client');

const UpdateCurrencyTable = require('./CurrencyTableUpdater');
const UpdatePLTable = require('./ProfitAndLossViewUpdater');


async function Main()
{
    const notion = new Client({ auth: process.env.NOTION_SECRET_KEY });

    try
    {
        if(process.env.UPDATE_CURRENCY_TABLE == 1)
            await UpdateCurrencyTable(notion);
        
        if(process.env.UPDATE_PL_TABLE == 1)
            await UpdatePLTable(notion);

    }catch(err)
    {
        console.log(err);
    }
}

Main();