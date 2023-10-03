import { getActiveTabURL } from "./utlity.js";
//url lega or check karega ki link  youtube ki hai ya nahi
document.addEventListener("DOMContentLoaded", async () =>{
    const activeTab = await getActiveTabURL();
    const container = document.getElementsByClassName("container")[0];
    if (activeTab.url.includes("youtube.com")){
            container.innerHTML = '<div class="title">AB SAHI HAI</div>';
          }
        else {
            container.innerHTML = '<div class="title" style=" background-color: #eb3700;">YE YOUTUBE NAHI HAI BHAI</div>';
          }
    
});