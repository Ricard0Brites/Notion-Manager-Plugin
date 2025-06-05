module.exports = {UpdatePage};
async function UpdatePage(notion, PageID, Update) 
{
    const response = await notion.pages.update
    (
        {
            page_id: PageID,
            properties: Update
        }
    );
    console.log(response);    
}