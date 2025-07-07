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

async function AddPage(notion, ParentID, Properties) 
{
    try 
    {
        if(notion == null)
        {
            if(process.env.LOG == 1)
                console.log('Error: notion Reference is Not Valid @Static.js::AddPage()');
            return;
        }

       const PageResponse = await notion.pages.create(
        {
            parent: { database_id: ParentID },
            properties: Properties
        });

        return PageResponse;
    } 
    catch (error) 
    {
        if(process.env.LOG == 1)
            console.error("Error adding row: ", error);
        console.log(error);
    }
}

async function DeletePage(notion, PageID)
{
    if(!notion)
    {
        if(process.env.LOG == 1)
            console.log('Error at ' + __dirname + 'DeletePage()->notion is not valid');

        return;
    }
	await notion.pages.update({
	  page_id: PageID,
	  in_trash: true,
	});
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

    /**
     * @enum {MimeTypes} Mimes
     */
    static MimeTypes = 
    {
        // Google Workspace Docs
        GOOGLE_DOC: 'application/vnd.google-apps.document',
        GOOGLE_SHEET: 'application/vnd.google-apps.spreadsheet',
        GOOGLE_SLIDE: 'application/vnd.google-apps.presentation',
        GOOGLE_FORM: 'application/vnd.google-apps.form',
        GOOGLE_DRAWING: 'application/vnd.google-apps.drawing',
        GOOGLE_SCRIPT: 'application/vnd.google-apps.script',
        GOOGLE_SITE: 'application/vnd.google-apps.site',
        GOOGLE_MAP: 'application/vnd.google-apps.map',

        // Folders & Shortcuts
        FOLDER: 'application/vnd.google-apps.folder',
        SHORTCUT: 'application/vnd.google-apps.shortcut',

        // Files (Regular Uploads)
        PDF: 'application/pdf',
        ZIP: 'application/zip',
        JSON: 'application/json',
        JAVASCRIPT: 'application/javascript',
        PLAIN_TEXT: 'text/plain',
        CSV: 'text/csv',
        MARKDOWN: 'text/markdown',

        // Images
        JPEG: 'image/jpeg',
        JPG: 'image/jpeg',
        PNG: 'image/png',
        SVG: 'image/svg+xml',
        GIF: 'image/gif',
        BMP: 'image/bmp',
        WEBP: 'image/webp',

        // Audio
        MP3: 'audio/mpeg',
        WAV: 'audio/wav',
        OGG: 'audio/ogg',

        // Video
        MP4: 'video/mp4',
        WEBM: 'video/webm',
        AVI: 'video/x-msvideo',

        // Office Files
        MS_WORD: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        MS_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        MS_POWERPOINT: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };
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

    static async GetDataFromRelationField(DataIn)
    {
        if(!DataIn)
            return null;

        try
        {
            var Response = [];
            for(var Rel of DataIn.relation)
            {
                const cache = await axios.get(`https://api.notion.com/v1/pages/${Rel.id}`, 
                {
                    headers: 
                    {
                    'Authorization': `Bearer ${process.env.NOTION_SECRET_KEY}`,
                    'Notion-Version': process.env.NOTION_VERSION,
                    'Content-Type': 'application/json'
                    }
                });

                Response.push(cache.data);
            }
            return Response;
        }
        catch(Error)
        {
            if(process.env.log == 1)
                console.log(Error);
        }
    }

    static GetDataFromDateField(DataIn)
    {
        if(!DataIn)
            return null;

        switch(DataIn.type)
        {
            case 'created_time':
                return DataIn.created_time;
                break;
            
            default:
                console.log('Type: ' + DataIn.type);
                break;
        }
    }

    static GetDataFromAttachmentField(DataIn)
    {
        if(!DataIn)
            return null;

        var Cache = [];

        for(const Attachment of DataIn)
        {
            Cache.push(Attachment.file.url);
        }
        return Cache;
    }
}

module.exports = {UpdatePage, AddPage, ApplicationStatics, NotionDataReader, RequestDatabase, DeletePage};
