
require('dotenv').config();
const { RequestDatabase, NotionDataReader, AddPage, DeletePage, UpdatePage} = require('./src/Statics.js');
const {SingleTextField,NumberField,RelationField, DateField, URLField} = require('./src/DataTypes.js');
const { GoogleDrive } = require('./GoogleDrive.js');
const { default: axios } = require('axios');
const fs = require('fs');
const path = require('node:path');

const CacheBaseDir = path.join(process.cwd(), 'Cache');

class ExpenseTransferer
{
    #BackendTableID = process.env.EXPENSE_TABLE_ID;
    #FormID = process.env.EXPENSE_FORM_ID;

    #FilesToDestroy = [];

    //Returns true if everything is valid
    #MeetsValidityRequirements(notion)
    {
        var FinalState = true;

        if(this.#BackendTableID.length <= 0) // Do we have a Valid ID?
            FinalState = false;

        if(this.#FormID.length <= 0) // Do we have a Valid ID?
            FinalState = false;

        if(!notion) // Is notion a valid object?
            FinalState = false;

        return FinalState;
    }

    async #CacheTempFile(FileHeaderRequestData, FileName) 
{
    if (!fs.existsSync(CacheBaseDir)) 
    {
        fs.mkdirSync(CacheBaseDir, { recursive: true });
    }

    const FilePath = path.join(CacheBaseDir, FileName);
    const ws = fs.createWriteStream(FilePath);
    this.#FilesToDestroy.push(FilePath);

    return new Promise((resolve, reject) => 
    {
        FileHeaderRequestData
            .pipe(ws)
            .on('finish', () => resolve(FilePath))
            .on('error', reject);

        FileHeaderRequestData.on('error', reject);
    });
}

    async #CleanUp()
    {
        
        for (let filePath of this.#FilesToDestroy) 
        {
            try 
            {
                await fs.promises.unlink(filePath);

                if(process.env.LOG == 1)
                    console.log(`Deleted: ${filePath}`);
            } 
            catch (err) 
            {
                if(process.env.LOG == 1)
                    console.error(`Failed to delete ${filePath}:`, err.message);
            }
        }
    }

    //-------------------------------------------------------------------------------------------------------
    
    //public
    async TransferData(notion)
    {
        try
        {
            const Drive = new GoogleDrive();
            await Drive.Init();


            if(!this.#MeetsValidityRequirements(notion))
                return false;
            

            // Get Form Data
            const Raw_PendingExpenses = await RequestDatabase(notion, this.#FormID);

            //Get Database Data (to extract Headers. AKA column names)
            const Raw_BackendDatabase = await RequestDatabase(notion, this.#BackendTableID);
            const BackendDatabaseHeaders = Object.keys(Raw_BackendDatabase.results[0].properties).reverse();

            for(var BaseResponse of Raw_PendingExpenses.results)
            {
                // Get Currency [Relation Field]
                const Currency_Raw = await NotionDataReader.GetDataFromRelationField(BaseResponse.properties.Currency);
                const Currency = Currency_Raw[0].id;

                //Get Entity [Relation Field]
                const Entity_Raw = await NotionDataReader.GetDataFromRelationField(BaseResponse.properties['Spender Entity']);
                const Entity = Entity_Raw[0].id;

                //Get Expense Category [Relation Field]
                const Category_Raw = await NotionDataReader.GetDataFromRelationField(BaseResponse.properties['Expense Category']);
                const Category = Category_Raw[0].id;

                //Get Expense Description [Text Field]
                const Description = NotionDataReader.GetDataFromSingleTextField(BaseResponse.properties['Expense Description'])
            
                //Get Expense Date [Date Field]
                const DateOfSpendage = NotionDataReader.GetDataFromDateField(BaseResponse.properties['Date Created']);

                //Get Amount Spent [Number Field]
                const AmountSpent = NotionDataReader.GetDataFromNumberField(BaseResponse.properties['Amount Spent']);

                //Get Documents
                const Files = BaseResponse.properties.Receipt.files;
                
                /*
                    Since notion cannot share the same link in multiple tables i've 
                    opted to upload the file to my google drive (chosen dynamically with google's Auth 2.0 API).
                    So now all we to do is:
                        - download the file thats in the notion database 
                        - upload it to Google Drive
                        - populate the backend table with the drive link(named after the backend Database entry ID)
                        - delete the local file.
                */
                let UrlToInsert = '';
                
                //Add Entry to backend database
                let OBJToAdd = {
                    ...SingleTextField(BackendDatabaseHeaders[0], Description),
                    ...RelationField(BackendDatabaseHeaders[4], [Entity]),
                    ...RelationField(BackendDatabaseHeaders[1], [Category]),
                    ...DateField(BackendDatabaseHeaders[2], DateOfSpendage),
                    ...NumberField(BackendDatabaseHeaders[5], AmountSpent),
                    ...RelationField(BackendDatabaseHeaders[6], [Currency]),
                    ...URLField(BackendDatabaseHeaders[3], UrlToInsert)
                };

                const NewPage = await AddPage(notion, this.#BackendTableID, OBJToAdd);

                for(let File of Files)
                {
                    if(File.type == 'file')
                    {
                        //Get File From URL
                        const response = await axios.get(File.file.url, {responseType: 'stream'});
                        
                        //Cache File Locally (not necessary but its a good practice bc of larger files)
                        const FilePath = await this.#CacheTempFile(response.data, File.name);

                        const Cache = await Drive.UploadSmallFile(FilePath, 'Notion Database/Expenses/' + BaseResponse.id);
                        UrlToInsert = 'https://drive.google.com/drive/folders/' + Cache.parent;
                    }
                }
                
                OBJToAdd = {
                    ...SingleTextField(BackendDatabaseHeaders[0], Description),
                    ...RelationField(BackendDatabaseHeaders[4], [Entity]),
                    ...RelationField(BackendDatabaseHeaders[1], [Category]),
                    ...DateField(BackendDatabaseHeaders[2], DateOfSpendage),
                    ...NumberField(BackendDatabaseHeaders[5], AmountSpent),
                    ...RelationField(BackendDatabaseHeaders[6], [Currency]),
                    ...URLField(BackendDatabaseHeaders[3], UrlToInsert)
                };

                //we have to update the page after creating it because the drive folder name is the id of the new page
                await UpdatePage(notion, NewPage.id, OBJToAdd);

                //Delete Page From Front-End Form 
                await DeletePage(notion, BaseResponse.id);
            }
            
            //Deletes cached files
           await this.#CleanUp();
        }
        catch(Error)
        {
            if(process.env.LOG == 1)
                console.log(Error);

                console.log(Error);
        }
        return true;
    };
}

module.exports = { ExpenseTransferer };
