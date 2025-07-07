const fs = require('fs');
const { ApplicationStatics } = require('./src/Statics.js')
const path = require('path');
const process = require('process');
const {authenticate} = require('@google-cloud/local-auth');
const { google } = require('googleapis');

/**
 * @enum {String} - mimes
 */
const MimeTypes = ApplicationStatics.MimeTypes;

require('dotenv').config();

class GoogleDrive
{
    #TOKEN_PATH;
    #CREDENTIALS_PATH;
    #SCOPES;
    #AuthClient;
    #drive;
    constructor()
    {
        this.#TOKEN_PATH = path.join(process.cwd(), 'token.json');
        this.#CREDENTIALS_PATH = path.join(process.cwd(), 'credentials_PC.json');
        this.#TOKEN_PATH = path.join(process.cwd(), 'token.json');
        // If modifying these scopes, delete token.json.
        this.#SCOPES = ['https://www.googleapis.com/auth/drive'];
        // The file token.json stores the user's access and refresh tokens, and is
        // created automatically when the authorization flow completes for the first
        // time.
    }

    /**
     * Call this right after instanciating the class. Not optional.
     */
    async Init()
    {
        try
        {
            this.#AuthClient = await this.#authorize();
            this.#drive = google.drive({version: 'v3', auth: this.#AuthClient});
        }
        catch(Err)
        {
            if(process.env.LOG == 1)
                console.log(Err);
        }
    }

    /**
    * Reads previously authorized credentials from the save file.
    * 
    * @async
    * @return {Promise<OAuth2Client|null>}
    */
    async #loadSavedCredentialsIfExist() 
    {
      try 
      {
        const content = await fs.promises.readFile(this.#TOKEN_PATH);
        const credentials = JSON.parse(content);
        return google.auth.fromJSON(credentials);
      } 
      catch (err) 
      {
        return null;
      }
    }

    /**
     * Serializes credentials to a file compatible with GoogleAuth.fromJSON.
     *
     * @async
     * @param {OAuth2Client} client
     * @returns {Promise<void>}
     */
    async #saveCredentials(client) 
    {
      const content = await fs.promises.readFile(this.#CREDENTIALS_PATH);
      const keys = JSON.parse(content);
      const key = keys.installed;
      const payload = JSON.stringify(
      {
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
      });
      

      await fs.promises.writeFile(this.#TOKEN_PATH, payload);
    }

    /**
     * Load or request or authorization to call APIs.
     *
     * @async
     * @returns {Promise<ClientAuth>} 
     * 
     */
    async #authorize() 
    {
        let client = await this.#loadSavedCredentialsIfExist();
        if (client) 
            return client;
       
        client = await authenticate(
        {
            scopes: this.#SCOPES,
            keyfilePath: this.#CREDENTIALS_PATH,
        });
        if (client.credentials)
        {
            await this.#saveCredentials(client);
        }
        return client;
    }

    /**
     * Lists the names and IDs of up to 10 files.
     * 
     * @async @function ListFiles
     * @param {OAuth2Client} authClient An authorized OAuth2 client.
     */
    async #ListFiles() 
    {
        let AllFiles = [], PageToken;

        do
        {
            const res = await this.#drive.files.list(
            {
                pageSize: 1000,
                fields: 'nextPageToken, files(id, name)',
                pageToken: PageToken,
                q: 'trashed = false'
            });

            AllFiles = AllFiles.concat(res.data.files);

            PageToken = res.data.nextPageToken;
        }
        while(PageToken)
        
        if (AllFiles.length === 0)
        {
            console.log('No files found.');
            return;
        }
        return AllFiles;
    }

    /**
     * @param {String} FileName - The Name of the file
     * @param {String} FileStream - The path to the file you want to upload
     * @param {String} FolderID - The ID of the folder to upload the file to. Leave empty to upload in drive root. (optional)
     * @param {Enumerator<MimeTypes>} FileType - The mime Type eg: image/png. this datatype is in statics.js
     */
    async #UploadFile(FileName, FileStream, FolderID, FileType)
    {
        var requestBody;
        if(FolderID === '')
        {
            requestBody = 
            {
                name: FileName,
            };
        }
        else
        {
            requestBody = 
            {
                name: FileName,
                parents: [FolderID],
            };
        }
        const media = 
        {
            mimeType: FileType,
            body: FileStream,
        };
        try 
        {
            const file = await this.#drive.files.create( //service.files.create ?? TODO - Figure out if its google.files.create or not, if its service include the module @ricardobrites
            {
                requestBody,
                media: media,
            });
            return file.data.id;
        } 
        catch (err) 
        {
            if(process.env.LOG == 1)
                console.log(err);
        }
    }

    /**
     * 
     * @param {String} FolderName - The name of the folder to be created
     * @param {String} ParentFolderID - The ID of the parent 
     * @returns {String} - Returns the id of the new folder
     * 
     */
    async #CreateDriveFolder(FolderName, ParentFolderID=null)
    {
        var FileMetadata = 
        {
            name: FolderName,
            mimeType: 'application/vnd.google-apps.folder',
        }
        if (ParentFolderID) 
        {
            FileMetadata['parents']= [ParentFolderID]
        }

        const res = await this.#drive.files.create(
        {
            resource: FileMetadata,
            fields: 'id, name',
        });

        if(process.env.LOG == 1)
            console.log(`Created folder "${res.data.name}" with ID: ${res.data.id}`)

        return res.data.id
    }

    /**
     * 
     * @param {String} FolderPath - eg: 'Folder1/Subfolder/'
     * 
     * @returns {String[]} - [Folder1, Subfolder]
     */
    #SplitPath(FolderPath)
    {
        return FolderPath.split('/').filter(Boolean);
    }

    /**
     * If the folder does not exist it is created then its ID is returned.
     * @param {String} FolderPath - The path to the folder in drive.
     * @returns {String}
     */
    async #GetFolderID(FolderPath)
    {
        const TargetFolderStructure = this.#SplitPath(FolderPath);
        const GCS_AllFiles = await this.GetAllFiles();

        /**
        * {
        *   FolderName: String,
        *   FolderID: String
        * }
        * @type {Target[]}
        */
        var Targets = [];
                
        //Fill Targets
        for(const Folder of TargetFolderStructure)
        {
            Targets.push(
            {
                FolderName: Folder,
                FolderID: ''
            });
        }
                
        var LowestFoundIndex = Targets.length;
                
        //Invert Order to search for lower hierarchy members first. (if we find the lowest we dont have to get the ones above it)
        Targets.reverse();
        let FolderID = '';

        for(let DriveFolder of GCS_AllFiles)
        {
            const DriveFolderName = DriveFolder.name;
            const DriveFolderID = DriveFolder.id;

            //Skip Files
            if(/\.[^./\\]+$/.test(DriveFolderName))
                continue;

            let Index = 0;

            for(const TargetFolder of Targets)
            {
                if(TargetFolder.FolderName === DriveFolderName)
                {
                    TargetFolder.FolderID = DriveFolderID;
                    if(Index < LowestFoundIndex)
                        LowestFoundIndex = Index;
                    break; 
                    // we can break as soon as we find one because this array is ordered by
                    // hieararchical importance.Meaning that the first entry we find is more important then any others.
                    // And its also the only entry thats gonna 'match' this DriveFolder.name
                }
                Index++;
            }
                    
            if(Targets[0].FolderID != '')
            {
                FolderID = Targets[0].FolderID;
                break;
            }
        }
        if(FolderID == '')
        {
            for(let i = LowestFoundIndex - 1; i < Targets.length && i >= 0; --i)
            {
                const NewFolderName = Targets[i].FolderName;
                let ParentID;
                        
                if(Targets.length - 1 < i+1)
                    ParentID = null;
                else
                    ParentID = Targets[i+1].FolderID;

                if(NewFolderName === '')
                {
                    if(process.env.LOG == 1)
                        console.log('NewFolderName Is empty. GoogleDrive::UploadSmallFile(); ' + __dirname);
                    return;
                }
                 
                //Create Folder Structure
                Targets[i].FolderID = await this.#CreateDriveFolder(NewFolderName, ParentID);
            }  
        }

        return Targets[0].FolderID;
    }

    /**
     * 
     * @param {String} FilePath
     * @returns {boolean} - True = File can be uploaded
     */
    #IsFileUnderSizeRequirements(FilePath)
    {
        const FileSize = fs.statSync(FilePath);
        if(FileSize.size > (5 * 1048576)) // 5MB
            return false;
        return true;
    }
    
    //----------------------------------------------------------------------------------------------------------------------------------------------

    //Public

    /**
     * 
     * @returns {object[String]} - An Array of folders in google drive
     */
    async GetAllFiles()
    {
        return await this.#ListFiles();
    }

    /**
     * This function uploads a small file to the authenticated user's drive
     * Small is defined by being <= 5Mb
     * Returns -> 
     * {
     *      parent: Folder ID,
     *      file: Direct Link To File
     * }
     * 
     * @param {String} FilePath - The path to the file you want to upload **MUST BE ABSOLUTE** eg: path.join(process.cwd(), 'src\\testimage.jpg')
     * @param {String} DriveFolderPath - The Path of the folder the file's gonna be uploaded to. If the Folder does not exist ti'll be created Dynamically. eg: 'folder1/folder2/' or 'folder1/folder2'.
     * 
     * @returns {Object} 
     */
    async UploadSmallFile(FilePath, DriveFolderPath='')
    {
        //Validations
        {
            //Validates the path coming in
            if(!FilePath || FilePath === '')
            {
                if(process.env.LOG == 1)
                    console.log('FilePath is invalid or empty; ' + __dirname);

                return;
            }

            //Validates file size. Breaks execution if file is over the limit
            //TODO - eventually we might want to add larger file upload compatibility. This is the place to do it instead of breaking execution.
            if(!this.#IsFileUnderSizeRequirements(FilePath))
            {
                if(process.env.LOG == 1)
                    console.log('File is over size Limit to upload: ' + __dirname);
                return '';
            }
        }
        
        let FolderID = await this.#GetFolderID(DriveFolderPath);

        if(process.env.LOG == 1)
            console.log('Starting Upload of: ' + FileName);

        //--------------------------------------------------------------------------------------------------
        {
            const FileName = path.basename(FilePath);
            const FileStream = fs.createReadStream(FilePath);
            const Ext = path.extname(FilePath).slice(1).toUpperCase();
            const Type = MimeTypes[Ext];

            var NewFileID = await this.#UploadFile(FileName, FileStream, FolderID, Type);

            if(process.env.LOG == 1)
            console.log('Finished Uploading: ' + FileName);
        }

        return {
            parent: FolderID,
            file: `https://drive.google.com/uc?export=download&id=${NewFileID}`
            };
    }


    async CreateDriveFolder(FolderName, ParentFolderID=null)
    {
        var FileMetadata = 
        {
            name: FolderName,
            mimeType: 'application/vnd.google-apps.folder',
        }
        if (ParentFolderID) 
        {
            FileMetadata['parents']= [ParentFolderID]
        }

        const res = await this.#drive.files.create(
        {
            resource: FileMetadata,
            fields: 'id, name',
        });

        if(process.env.LOG == 1)
            console.log(`Created folder "${res.data.name}" with ID: ${res.data.id}`)

        return res.data.id
    }
}

module.exports = { GoogleDrive};