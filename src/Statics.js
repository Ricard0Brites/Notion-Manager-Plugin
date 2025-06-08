module.exports = {UpdatePage};
async function UpdatePage(notion, PageID, Update) 
{
    MaxRetryAmount = 20;
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
    } catch (err)
    {
        //await new Promise(r => setTimeout(r, 500));
        console.log(err);
    } 

}