import { getActiveTabURL } from "./utility.js";
document.addEventListener("DOMContentLoaded", async () =>{
    const activeTab = await getActiveTabURL();
    const container = document.getElementsByClassName("container")[0];
    if (activeTab.url.includes("youtube.com/watch")){
            container.innerHTML = '<div class="title">AB SAHI HAI</div>';
          }
        else {
            container.innerHTML = '<div class="title">YE YOUTUBE NAHI HAI BHAI</div>';
          }
    
});