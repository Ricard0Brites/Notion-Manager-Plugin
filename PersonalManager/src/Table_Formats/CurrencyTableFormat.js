/*
    Long Name - Can be retrieved as empty. Cannot Be Set Empty
    Symbol - Cannot Be Empty Ever
    Category - Cannot Be Empty
    Extange Rate - Can Be retrieved as empty.  Cannot be set empty
*/
function MakeCurrencyTableEntryLiteral(LongName, Symbol, Category, ExtangeRate)
{
    return {...LongName, ...Symbol, ...Category, ...ExtangeRate};
}
module.exports = MakeCurrencyTableEntryLiteral;