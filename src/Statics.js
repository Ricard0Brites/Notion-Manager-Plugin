require('dotenv').config();
const { default: axios } = require('axios');

async function UpdatePage(notion, PageID, Update) 
{
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
    } 
    catch (err)
    {
        console.log(err);
    } 

}

//Does Not Take Filter Parameters

async function RequestDatabase(notion, DatabaseID, Filter)
{
    try
    {
        if(!notion)
        {
            if(process.env.LOG)
                console.log('notion variable is invalid at: ' + __filename);

            return null;
        }
        
        const NotionResponse = await notion.databases.query
        ({
            database_id: DatabaseID,
            filter: Filter
        });
        
        return NotionResponse;
    }
    catch(error)
    {
        if(process.env.LOG)
            console.log(error);
        
        return null;
    }
}
class ApplicationStatics
{
    //#region Currency Data
    static CurrencyData = {};

    static SetCurrencyData(NewData) { this.CurrencyData = NewData; }
    static GetCurrencyData() 
    {
        if(Object.keys(this.CurrencyData).length > 0)
            return this.CurrencyData;

        //Returns these values if in debug mode
        var DebugObject = 
        {
            USDC: 1,
            BTC: 106973.41257,
            EUR: 0.86866,
            USD: 1,
            CAD: 1.3629,
            AUD: 1.5442,
            JPY: 144.15,
            GBP: 0.73879
        };

        return DebugObject;
    }
    //#endregion


}

class NotionDataReader
{   
    static GetDataFromNumberField(DataIn)
    {
        if(!DataIn)
            return null;

        if(DataIn.type === 'number')
            return DataIn.number;

        return null;
    }

    static GetDataFromSingleSelectField(DataIn)
    {
        if(!DataIn)
            return null;

        if(DataIn.type === 'select')
            return DataIn.select.name;

        return null;
    }

    static GetDataFromSingleTextField(DataIn)
    {
        if(!DataIn)
            return null;

        if(DataIn.type === 'title')
            return DataIn.title[0].plain_text;
        
        return null;
    }

    static async GetDataFromRelationField(PageID)
    {
        if(!PageID)
            return null;

        try
        {
            const Response = await axios.get(`https://api.notion.com/v1/pages/${PageID}`, 
            {
                headers: 
                {
                'Authorization': `Bearer ${process.env.NOTION_SECRET_KEY}`,
                'Notion-Version': process.env.NOTION_VERSION,
                'Content-Type': 'application/json'
                }
            });
            return Response.data;
        }
        catch(Error)
        {
            if(process.env.log == 1)
                console.log(Error);
        }
    }
}

module.exports = {UpdatePage, ApplicationStatics, NotionDataReader, RequestDatabase};
