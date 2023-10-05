
//theme select karne keliye
//alag alag thumbnail type keliye alag alag elements me url hota is keliye alag alag selectors hai
//href attribute se link extract karne keliye hume dekhna padega ki thambnail ki theme kya
//refernce from @elliotwaite
let curTheme = 0  
const modern = 1 
const classic = 2  
const gaming = 3  
const mobile = 4  
const total = 4
const isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') === ' #181818'
const selector = []
selector[modern] = '' +
    'a#thumbnail[href]'

selector[classic] = '' +
    '.video-thumb' +
    ':not(.yt-thumb-20)' +
    ':not(.yt-thumb-27)' +
    ':not(.yt-thumb-32)' +
    ':not(.yt-thumb-36)' +
    ':not(.yt-thumb-48)' +
    ':not(.yt-thumb-64), ' +
    '.thumb-wrapper, ' +
    '.pl-header-thumb'

selector[gaming] = '' +
    'ytg-thumbnail' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

selector[mobile] = '' +
    'a.media-item-thumbnail-container, ' +
    'a.compact-media-item-image, ' +
    'a.video-card-image'
    
const videowall = '' +
    'a.ytp-videowall-still'

//DOM mutation handle karne keliye max 100ms delay hai 
const DOMmutationdelay = 100
let domisthrotled = false
let unseenDOMmuttaion = false
//API request retry karne keliye
const apidelay = 5000
//ek thumbnail ke liye max 10 retries hai
const max_try = 10
//API request retry karne keliye
let pendingrequest = false
let retrythambnails = []
//rating keliye function hai video dekhne layak hai ya nahi ye batane keliye
function JSrating(videoData){
  let x=videoData.likes
  let y=videoData.dislikes+1
  let dontwatch,watch
    watch = '<ytrb-bookmark id="'+x+'">' +'<ytb-image>'+'	&#9989;'+'</ytb-image>'+
                    '</ytrb-bookmark>'
    dontwatch= '<ytrb-bookmark id="'+x+'">' +'<ytb-image>'+'&#10060;'+'</ytb-image>'+
                    '</ytrb-bookmark>'
  if(x/y>25)
  {
    return '<ytrb-bar style="opacity:1;">' +watch+'<ytrb-tooltip><div>' + "Dekhne layak" +'</div></ytrb-tooltip>'+'</ytrb-bar>'}
else {
  return '<ytrb-bar style="opacity:1;">' + dontwatch+'<ytrb-tooltip><div>' + "Samay ki Barbadi" +'</div></ytrb-tooltip>'+'</ytrb-bar>'
}
  }
//likes dislike display keliye function hai
function getlikesdislikes(videoData) {
  return '<h5  class="style-scope ytd-video-meta-block ytd-grid-video-renderer ytrb-percentage">'+'&nbsp;|&nbsp;'+'&#128077;'+videoData.likes.toLocaleString()+'&nbsp;|&nbsp;'+'&#128078;'+videoData.dislikes.toLocaleString()+'</h5>'
}
//ye thambnail ke hisab se DOM elemnt change karne keliye hai 
//reference from @elliotwaite
function getnewthambnail() {
  let THAMBNAIL = []
  //agar curtheme hai to hum usko select karenge
  //agar nahi hai to hum sare themes keliye check karenge ki konsa theme select hai
  if (curTheme) {
    THAMBNAIL = $(selector[curTheme])
  } else {
    for (let i = 1; i <= total; i++) {
      THAMBNAIL = $(selector[i])
      if (THAMBNAIL.length) {
        curTheme = i
        break}}}
  //videowall se merge karenge THAMBNAIL ko
  //videowall basically structure hai jisme video ko play karne keliye hai or jispe thumbnail bhi hote hai 
//yaha humne thambnail videowall ke sath  send kiya agge hum new thambnail load karenge rating or likes and disklikes ko sath he display karenge
  THAMBNAIL = $.merge(THAMBNAIL, $(videowall))
  return THAMBNAIL}
//ye function THAMBNAIL ke hisab se id or thumbnail return karega
// jo video id ka link vo href attribute me hota hai use extract karega
//basically alag alag theme keliye alag alag elements me attribute hoga to alag alag selectors hai 
function getidandthumbnail(THAMBNAIL) {
  const thumbnailandid = []
  $(THAMBNAIL).each(function(_, thumbnail) {
    let url
    if (curTheme === modern) {
      url = $(thumbnail).attr('href')
    } else if (curTheme === classic) {  //ye basically apan bas dhund rahe hai ki konsa element hai jisme href attribute hai
      url = $(thumbnail).attr('href')   //har yek theme ke hisab se vo element alag alag hai 
          || $(thumbnail).parent().attr('href')//basically hum sare combination check kar rahe hai ki konsa element hai jisme href attribute hai
          || $(thumbnail).parent().parent().attr('href')//isliye OR operation use kar rahe hai
          || $(thumbnail).children(':first').attr('href')
          || $(thumbnail).children(':first').next().attr('href')
} else if (curTheme === gaming) {
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).parent().parent().parent().attr('href')
      if (!$(thumbnail).is('a')) {
        thumbnail = $(thumbnail).parent()
      }} else if (curTheme === mobile) {
      url = $(thumbnail).attr('href')
      const firstChild = $(thumbnail).children(':first')[0]
      if ($(firstChild).is('.video-thumbnail-container-compact')) {
        thumbnail = firstChild}} else {
      url = $(thumbnail).attr('href')}
      //agar url mil nahi to hum true return karenge or empty thumbnailandid return karenge
      //basically vo thambnail nahi tha jisme href attribute tha 
    if (!url) {
      return true}
    const previousUrl = $(thumbnail).attr('data-ytrb-processed')
    if (previousUrl) {
      //agar previous url or current url same hai to hum true return karenge
      //matlab humne usko pehle process kar liya hai
      //agar mobile theme hai to hum usko check karenge ki uske last child me ytrb-bar hai ya nahi
      //agar hai to hum true return karenge
      if (previousUrl === url) {
        if (curTheme === mobile) {
          if ($(thumbnail).children().last().is('ytrb-bar')) {
            return true
          } } else {
          return true
        }}
        //nahi to fhir hum usko remove kar denge or usko data-ytrb-retries attribute se remove kar denge
         else {
        $(thumbnail).children('ytrb-bar').remove()
        $(thumbnail).removeAttr('data-ytrb-retries')}}
    //yaha humne data-ytrb-processed attribute add kar diya or usme url store kar diya
    //usko processed mark kar diya hai
    $(thumbnail).attr('data-ytrb-processed', url)
    const match = url.match(/.*[?&]v=([^&]+).*/)
    //yaha humne url liya hai or usko match kar rahe hai 2 jaga pe v ke pehele or baadme or dusra vala match humne id ke liye kiya hai
    if (match) {
      const id = match[1]//video id hai ye
      thumbnailandid.push([thumbnail, id])//thumbnail or id push kar diya or fhir return kiya
    }})
  return thumbnailandid}
//jessa naam vessa kaam video data object return karega jisme likes or dislikes honge
function getVideoDataObject(likes, dislikes) {
  return {
    likes: likes,
    dislikes: dislikes,
  }
}
//ye agge ane vale THAMBNAIL ko process karega
function retryProcessingThumbnailInTheFuture(thumbnail) {
  retrythambnails.push(thumbnail)
  //agar api retry pending hai to hum usko delay karenge apidelay ke hisab se 5 sec
  if (!pendingrequest) {
    pendingrequest = true
    setTimeout(() => {
      pendingrequest = false
      //yek thumbnail ke liye max 10 retries hai
      //yaha hum uss thambnail keliye request bhej rahe hai
      retrythambnails.forEach(thumbnail => {
        //yaha kitne try hue hai vo check kar rahe hai
        //retry attribute me store hai kitne try hue hai
        const retriesAttr = $(thumbnail).attr('data-ytrb-retries')
        const retriesNum = retriesAttr ? Number.parseInt(retriesAttr, 10) : 0
        //agar retriesNum max_try se kam hai to hum usko retry karenge
        //retry attribute increase kar denge or data-ytrb-processed attribute remove kar denge
        //or unseenDOMmuttaion ko true kar denge taki hum usko DOM mutation handle karne keliye bhej sake
        if (retriesNum < max_try) {
          $(thumbnail).attr('data-ytrb-retries', retriesNum + 1)
          $(thumbnail).removeAttr('data-ytrb-processed')
          unseenDOMmuttaion = true
        }
      })
      retrythambnails = []
      handleDomMutations()
    }, apidelay)
  }
}
//ye function video API request send karega or likes or dislikes return karega
function getVideoData(thumbnail, videoId) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      {query: 'Request', videoId: videoId},
      (likesData) => {
        //agar nahi aya data to retry karenge or null return karenge nahi to fhir hum likes or dislikes return karenge
        if (likesData === null) {
          retryProcessingThumbnailInTheFuture(thumbnail)
          resolve(null)}
        else {
          resolve(getVideoDataObject(likesData.likes, likesData.dislikes))
        }})})}
//ye rating display karega
function rating(thumbnail, videoData) {
  $(thumbnail).append(JSrating(videoData))
}
//ye like or dislikes ko meta line pe show karne keliye hai
//reference from @elliotwaite
function likesanddislikes(thumbnail, videoData) {
  //yaha humne metadata line ko dhund ke select karenge jaha hum likes or dislikes dikha rahe hai
  let metadataLine
  if (curTheme === mobile) {
    metadataLine = $(thumbnail).closest('ytm-media-item').find('ytm-badge-and-byline-renderer').last()
  } else {
    metadataLine = $(thumbnail).closest(
      '.ytd-rich-item-renderer, ' +  // Home page.
      '.ytd-grid-renderer, ' +  // Trending and subscriptions page.
      '.ytd-expanded-shelf-contents-renderer, ' +  // Subscriptions page.
      '.yt-horizontal-list-renderer, ' +  // Channel page.
      '.ytd-item-section-renderer, ' +  // History page.
      '.ytd-horizontal-card-list-renderer, ' +  // Gaming page.
      '.ytd-playlist-video-list-renderer' // Playlist page.
    ).find('#metadata-line').last()
  }
  if (metadataLine) {
    for (const oldlikes of metadataLine.children('.ytrb-percentage')) {
      oldlikes.remove()}
    if (curTheme === mobile) {
      for (const oldlikes of metadataLine.children('.ytrb-percentage-separator')) {
        oldlikes.remove()
      }}
      const oldlikes = getlikesdislikes(videoData)
      const lastSpan = metadataLine.children('span').last()
      if (lastSpan.length) {
        lastSpan.after(oldlikes)
        if (curTheme === mobile) {
          lastSpan.after('<span class="ytm-badge-and-byline-separator ytrb-percentage-separator" aria-hidden="true">•</span>')
        }
      } else {
        metadataLine.prepend(oldlikes)
        metadataLine.prepend('<span class="style-scope ytd-video-meta-block"></span>')
      }}}
//ye new THAMBNAIL process karne keliye hai or uske display karenge rating or likes and dislikes
function newthambnailload() {
  const THAMBNAIL = getnewthambnail()
  const thumbnailandid = getidandthumbnail(THAMBNAIL)
  for (const [thumbnail, videoId] of thumbnailandid) {
    getVideoData(thumbnail, videoId).then(videoData => {
      if (videoData !== null) {
          rating(thumbnail, videoData)
          likesanddislikes(thumbnail, videoData)
        }})}}
//ye DOM mutation handle karne keliye hai agar useenmututation true hai 
//matlab jo mutation humne DOM me kiya hai or likes dislikes display kiya hai vo abhi tak humne dekha nahi hai 
//agar sare mutation dekhe hai to new thambnail process karenga


//Sankshipt roop se kahe to yah kood DOM (Document Object Model) ki parivartan ko sambhalne ke liye viksit 
//kiya gaya hai, lekin yah aisa dhima dharmik tarike se karta hai taki parivartan ko bahut adhik baar prakriya 
//na kare. Yah ek jhanda set karta hai jo darust karta hai jab DOM parivartan ko rok diya gaya hai, naye THAMBNAIL ko 
//prakriya karata hai yadi ve rokhe nahi gaye hain, aur dekha ja sakta hai ki kisi bache huye anupasthit DOM parivartan ko 
//prakriya karne se pahle vilin kiye gaye parivartan ko karne se pahle vilin kiya jata hai. MutationObserver ka upayog DOM 
//parivartan ho jane par is prakriya ko dekhne aur prarambh karne ke liye kiya jata hai.
function handleDomMutations() {
  if (domisthrotled) {
    unseenDOMmuttaion = true
  } else {
    domisthrotled = true
      newthambnailload()
    unseenDOMmuttaion = false
    setTimeout(function() {
      domisthrotled = false
      if (unseenDOMmuttaion) {
        handleDomMutations()
      }}, DOMmutationdelay)}}
const mutationObserver = new MutationObserver(handleDomMutations)
//cssFile  message query send karne keliye hai 
chrome.storage.sync.get(function() {
   
  const cssFiles = []
  //isme sari css files push kar rahe hai jo hum background me inject karenge
    cssFiles.push('css/bar.css')
      cssFiles.push('css/bar-bottom.css')
      cssFiles.push('css/bar-tooltip.css')
        cssFiles.push('css/bar-bottom-tooltip.css')
      cssFiles.push('css/bar-video-page.css')
    chrome.runtime.sendMessage({
      query: 'Css',
      files: cssFiles,
    })
    //yaha observer add kar rahe hai DOM mutations ke liye jo changes check karega
  handleDomMutations()
  mutationObserver.observe(document.body, {childList: true, subtree: true})
})