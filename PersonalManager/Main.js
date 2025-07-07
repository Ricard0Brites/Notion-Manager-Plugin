require('dotenv').config();
const { Client } = require('@notionhq/client');

const UpdateCurrencyTable = require('./CurrencyTableUpdater');
const ProfitAndLossTableUpdater = require('./ProfitAndLossViewUpdater');
const { ExpenseTransferer } = require('./ExpenseTransferer.js')
const { google } = require('googleapis');



async function Main()
{
    const notion = new Client({ auth: process.env.NOTION_SECRET_KEY });
    const Google = new google.auth.GoogleAuth(
    {
        keyFile: 'service-account.json',
        scopes: ['https://www.googleapis.com/auth/drive'],
    });
    
    try
    {
        //Class Instance creation
        const PL = new ProfitAndLossTableUpdater();
        const ExpensesManager = new ExpenseTransferer();

        if(process.env.UPDATE_CURRENCY_TABLE == 1)
            await UpdateCurrencyTable(notion);
        
        if(process.env.UPDATE_PL_TABLE == 1)
            await PL.UpdatePLTable(notion);

        if(process.env.ENABLE_EXPENSES == 1)
            await ExpensesManager.TransferData(notion);

    }catch(err)
    {
        console.log(err);
    }
}

Main();