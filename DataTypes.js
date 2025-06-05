    module.exports = {
        SingleTextField,
        SingleSelectField,
        NumberField
    }

    function SingleTextField(FieldName, NewText) 
    {
        if(FieldName === "" || NewText === "")
            return{};

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
        if(FieldName === "" || NewValue === "")
            return{};

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
        if(FieldName === "" || NewValue === "")
            return{};

        return {
            [FieldName]:
            {
                number: NewValue
            }
        };
    }
