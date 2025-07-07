module.exports = {
    SingleTextField,
    SingleSelectField,
    NumberField,
    RelationField,
    AttachmentField,
    DateField,
    URLField
};

function SingleTextField(FieldName, NewText) 
{
    if (!FieldName || !NewText)
        return {};

    return {
        [FieldName]: 
        {
            title: 
            [
                {
                    text: 
                    {
                        content: NewText
                    }
                }
            ]
        }
    };
}

function SingleSelectField(FieldName, NewValue) 
{
    if (!FieldName || !NewValue)
        return {};

    return {
        [FieldName]: 
        {
            select: 
            {
                name: NewValue
            }
        }
    };
}

function NumberField(FieldName, NewValue) 
{
    if (!FieldName || NewValue === undefined || NewValue === null)
        return {};

    return {
        [FieldName]: 
        {
            number: NewValue
        }
    };
}

/**
 * 
 * @param {String} FieldName
 * @param {Array[String]} PageIdArray
 * @returns {Object}
 */
function RelationField(FieldName, PageIdArray) 
{
    if (!FieldName || !Array.isArray(PageIdArray) || PageIdArray.length === 0)
        return {};

    return {
        [FieldName]: 
        {
            relation: PageIdArray.map(id => ({ id }))
        }
    };
}

/**
 * 
 * @param {String} FieldName - The Name of the column this entry is being inserted to
 * @param {{Name: String, URL: String}} FileArray
 * @returns
 */
function AttachmentField(FieldName, FileArray) 
{
    if (!FieldName || !Array.isArray(FileArray) || FileArray.length === 0)
        return {};

    const OBJ = [];
    for(let file of FileArray)
    {
        let Cache = 
        {
            name: file.Name,
            type: 'external',
            external:
            {
                url: file.URL
            }
        };

        OBJ.push(Cache);
    }

    const ReturnValue = 
    {
        [FieldName]: OBJ
    };

    return ReturnValue;
}

function DateField(FieldName, ISODateString) 
{
    if (!FieldName || !ISODateString)
        return {};

    return {
        [FieldName]: 
        {
            date: 
            {
                start: ISODateString
            }
        }
    };
}

/**
 * 
 * @param {String} FieldName
 * @param {String} URL
 * @returns {Object}
 */
function URLField(FieldName, URL)
{
    if (!FieldName || !URL)
        return {};

    return {[FieldName]:{url: URL}};
}
