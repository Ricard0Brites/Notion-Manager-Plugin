const axios = require('axios');

class CryptoDataFetcher 
{
    constructor(APISecretKey, CryptosToList) 
    {
        this.SECRETKEY = APISecretKey;
        this.LIST = CryptosToList;
        this.CryptoData = [];
    }

    async FetchData() 
    {
        //Request Data Update From CMC
        try 
        {
            const requestHeaders = { headers: { 'X-CMC_PRO_API_KEY': this.SECRETKEY }};
            const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', requestHeaders);
            const allCryptos = response.data.data;

            for (const crypto of allCryptos) 
            {
                if (this.LIST.includes(crypto.symbol))
                {
                    this.CryptoData.push({[crypto.symbol]: crypto});
                }
            }

            return this.CryptoData;
        } 
        catch (error) 
        {
            console.error('Failed to fetch crypto data:', error);
            throw error;
        }

    }
}

module.exports = CryptoDataFetcher;
