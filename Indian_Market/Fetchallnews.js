async function fetchallnews(){
let res= await fetch("https://api.stockedge.com/Api/DailyDashboardApi/GetLatestNewsItems?page=1&pageSize=10&sectionType=null&lang=en.")
let res1= await res.json()
return res1
}


module.exports=fetchallnews