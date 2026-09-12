async function GetAllResult(page=1,pageSize=10) {
    
let data= await fetch(`https://api.stockedge.com/Api/DailyDashboardApi/GetForthcomingCorporateActionResults?page=${page}&pageSize=${pageSize}&lang=en
`)

let res1= await data.json()

return res1

}


async function Getquestionaboutshare(id) {
let data= await fetch(`https://api.stockedge.com/Api/SecurityDashboardApi/GetQnAsDataForSecurity/${id}?lang=en
`)
let res1= await data.json()
return res1
}     


async function CompanyChartperfomance(id) {
    
let data= await fetch(`https://api.stockedge.com/Api/ListingDashboardApi/GetListingTechnicalPerformance/${id}?lang=en
`)
let res1= await data.json()
return res1
}



async function CompanyFundamentals(id) {
    
let data= await fetch(`https://api.stockedge.com/Api/SecurityDashboardApi/GetResultStatementSet/${id}/2/3?lang=en
`)
let res1= await data.json()
return res1
}



module.exports={GetAllResult}



// api.stockedge.com/Api/SecurityDashboardApi/GetSecurityOverview/7477?lang=en

// api.stockedge.com/Api/SecurityDashboardApi/GetCompanyEquityInfoForSecurity/7477?lang=en
