
//DOM mutation handle karne keliye max 100ms delay hai 
const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100
let domMutationsAreThrottled = false
let hasUnseenDomMutations = false
//API request retry karne keliye
const API_RETRY_DELAY = 5000
//ek thumbnail ke liye max 10 retries hai
const MAX_RETRIES_PER_THUMBNAIL = 10
//API request retry karne keliye
let isPendingApiRetry = false
let thumbnailsToRetry = []
//theme select karne keliye
//alag alag thumbnail keliye alag alag elements hai link keliye hai isliye alag alag selectors hai
//refernce from @elliotwaite
let curTheme = 0  
const THEME_MODERN = 1 
const THEME_CLASSIC = 2  
const THEME_GAMING = 3  
const THEME_MOBILE = 4  
const NUM_THEMES = 4
const isDarkTheme = getComputedStyle(document.body).getPropertyValue('--yt-spec-general-background-a') === ' #181818'
const THUMBNAIL_SELECTORS = []
THUMBNAIL_SELECTORS[THEME_MODERN] = '' +
    'a#thumbnail[href]'

THUMBNAIL_SELECTORS[THEME_CLASSIC] = '' +
    '.video-thumb' +
    ':not(.yt-thumb-20)' +
    ':not(.yt-thumb-27)' +
    ':not(.yt-thumb-32)' +
    ':not(.yt-thumb-36)' +
    ':not(.yt-thumb-48)' +
    ':not(.yt-thumb-64), ' +
    '.thumb-wrapper, ' +
    '.pl-header-thumb'

THUMBNAIL_SELECTORS[THEME_GAMING] = '' +
    'ytg-thumbnail' +
    ':not([avatar])' +
    ':not(.avatar)' +
    ':not(.ytg-user-avatar)' +
    ':not(.ytg-box-art)' +
    ':not(.ytg-compact-gaming-event-renderer)' +
    ':not(.ytg-playlist-header-renderer)'

THUMBNAIL_SELECTORS[THEME_MOBILE] = '' +
    'a.media-item-thumbnail-container, ' +
    'a.compact-media-item-image, ' +
    'a.video-card-image'
    
const THUMBNAIL_SELECTOR_VIDEOWALL = '' +
    'a.ytp-videowall-still'
// default user settings diya hai option popup lagane ki soch raha tha but nahi huva 😢

const DEFAULT_USER_SETTINGS = {
  barTooltip: true,
  useOnVideoPage: false,
  showPercentage: false,
}

let userSettings = DEFAULT_USER_SETTINGS
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
//yaha hum sare themes keliye check karenge ki konsa theme select hai
//reference from https://github.com/elliotwaite
function getNewThumbnails() {
  let thumbnails = []
  if (curTheme) {
    thumbnails = $(THUMBNAIL_SELECTORS[curTheme])
  } else {
    for (let i = 1; i <= NUM_THEMES; i++) {
      thumbnails = $(THUMBNAIL_SELECTORS[i])
      if (thumbnails.length) {
        curTheme = i
        break}}}
  thumbnails = $.merge(thumbnails, $(THUMBNAIL_SELECTOR_VIDEOWALL))
  return thumbnails}
function getThumbnailsAndIds(thumbnails) {
  const thumbnailsAndVideoIds = []
  $(thumbnails).each(function(_, thumbnail) {
    let url
    if (curTheme === THEME_MODERN) {
      url = $(thumbnail).attr('href')
    } else if (curTheme === THEME_CLASSIC) {
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).children(':first').attr('href')
          || $(thumbnail).children(':first').next().attr('href')
} else if (curTheme === THEME_GAMING) {
      url = $(thumbnail).attr('href')
          || $(thumbnail).parent().parent().attr('href')
          || $(thumbnail).parent().parent().parent().attr('href')
      if (!$(thumbnail).is('a')) {
        thumbnail = $(thumbnail).parent()
      }} else if (curTheme === THEME_MOBILE) {
      url = $(thumbnail).attr('href')
      const firstChild = $(thumbnail).children(':first')[0]
      if ($(firstChild).is('.video-thumbnail-container-compact')) {
        thumbnail = firstChild}} else {
      url = $(thumbnail).attr('href')}
    if (!url) {
      return true}
    const previousUrl = $(thumbnail).attr('data-ytrb-processed')
    if (previousUrl) {
      if (previousUrl === url) {
        if (curTheme === THEME_MOBILE) {
          if ($(thumbnail).children().last().is('ytrb-bar')) {
            return true
          } } else {
          return true
        }} else {
        $(thumbnail).children('ytrb-bar').remove()
        $(thumbnail).removeAttr('data-ytrb-retries')}}
    $(thumbnail).attr('data-ytrb-processed', url)
    const match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      const id = match[1]
      thumbnailsAndVideoIds.push([thumbnail, id])
    }})
  return thumbnailsAndVideoIds}
//jessa naam vessa kaam video data object return karega
function getVideoDataObject(likes, dislikes) {
  return {
    likes: likes,
    dislikes: dislikes,
  }
}
//ye agge ane vale thumbnails ko process karega
function retryProcessingThumbnailInTheFuture(thumbnail) {
  thumbnailsToRetry.push(thumbnail)
  //agar api retry pending hai to hum usko delay karenge
  if (!isPendingApiRetry) {
    isPendingApiRetry = true
    setTimeout(() => {
      isPendingApiRetry = false
      //yek thumbnail ke liye max 10 retries hai
      //yaha hum uss thambnail keliye request bhej rahe hai
      thumbnailsToRetry.forEach(thumbnail => {
        const retriesAttr = $(thumbnail).attr('data-ytrb-retries')
        const retriesNum = retriesAttr ? Number.parseInt(retriesAttr, 10) : 0
        if (retriesNum < MAX_RETRIES_PER_THUMBNAIL) {
          $(thumbnail).attr('data-ytrb-retries', retriesNum + 1)
          $(thumbnail).removeAttr('data-ytrb-processed')
          hasUnseenDomMutations = true
        }
      })
      thumbnailsToRetry = []
      handleDomMutations()
    }, API_RETRY_DELAY)
  }
}
//ye function video API request send karega agar likesData null huva to retry karega nahi to videoDataObject return karega or fhir usko append karega thumbnail se 
function getVideoData(thumbnail, videoId) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(
      {query: 'videoApiRequest', videoId: videoId},
      (likesData) => {
        if (likesData === null) {
          retryProcessingThumbnailInTheFuture(thumbnail)
          resolve(null)}
        else {
          resolve(getVideoDataObject(likesData.likes, likesData.dislikes))
        }})})}
function rating(thumbnail, videoData) {
  $(thumbnail).append(JSrating(videoData))
}
//ye like or dislikes ko meta line pe show karne keliye hai
//reference from  https://github.com/elliotwaite
function likesanddislikes(thumbnail, videoData) {
  let metadataLine
  if (curTheme === THEME_MOBILE) {
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
    if (curTheme === THEME_MOBILE) {
      for (const oldlikes of metadataLine.children('.ytrb-percentage-separator')) {
        oldlikes.remove()
      }}
      const oldlikes = getlikesdislikes(videoData)
      const lastSpan = metadataLine.children('span').last()
      if (lastSpan.length) {
        lastSpan.after(oldlikes)
        if (curTheme === THEME_MOBILE) {
          lastSpan.after('<span class="ytm-badge-and-byline-separator ytrb-percentage-separator" aria-hidden="true">•</span>')
        }
      } else {
        metadataLine.prepend(oldlikes)
        metadataLine.prepend('<span class="style-scope ytd-video-meta-block"></span>')
      }}}
//ye new thumbnails process karne keliye hai
function processNewThumbnails() {
  const thumbnails = getNewThumbnails()
  const thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)
  for (const [thumbnail, videoId] of thumbnailsAndVideoIds) {
    getVideoData(thumbnail, videoId).then(videoData => {
      if (videoData !== null) {
          rating(thumbnail, videoData)
          likesanddislikes(thumbnail, videoData)
        }})}}
//ye DOM mutation handle karne keliye hai agar domMutationsAreThrottled true hai
//matlab jo mutation humne DOM me kiya hai vo abhi tak humne dekha nahi hai 
//agar sare mutation dekhe hai to new thambnail process karenga


//Sankshipt roop se kahe to yah kood DOM (Document Object Model) ki parivartan ko sambhalne ke liye viksit 
//kiya gaya hai, lekin yah aisa dhima dharmik tarike se karta hai taki parivartan ko bahut adhik baar prakriya 
//na kare. Yah ek jhanda set karta hai jo darust karta hai jab DOM parivartan ko rok diya gaya hai, naye thumbnails ko 
//prakriya karata hai yadi ve rokhe nahi gaye hain, aur dekha ja sakta hai ki kisi bache huye anupasthit DOM parivartan ko 
//prakriya karne se pahle vilin kiye gaye parivartan ko karne se pahle vilin kiya jata hai. MutationObserver ka upayog DOM 
//parivartan ho jane par is prakriya ko dekhne aur prarambh karne ke liye kiya jata hai.
function handleDomMutations() {
  if (domMutationsAreThrottled) {
    hasUnseenDomMutations = true
  } else {
    domMutationsAreThrottled = true
      processNewThumbnails()
    hasUnseenDomMutations = false
    setTimeout(function() {
      domMutationsAreThrottled = false
      if (hasUnseenDomMutations) {
        handleDomMutations()
      }}, HANDLE_DOM_MUTATIONS_THROTTLE_MS)}}
const mutationObserver = new MutationObserver(handleDomMutations)
//cssFile  message query send karne keliye hai 
chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function(storedSettings) {
    userSettings = storedSettings
  const cssFiles = []
  //isme sari css files push kar rahe hai jo hum background me inject karenge
    cssFiles.push('css/bar.css')
      cssFiles.push('css/bar-bottom.css')
      cssFiles.push('css/bar-tooltip.css')
        cssFiles.push('css/bar-bottom-tooltip.css')
      cssFiles.push('css/bar-video-page.css')
    chrome.runtime.sendMessage({
      query: 'insertCss',
      files: cssFiles,
    })
    //yaha observer add kar rahe hai DOM mutations ke liye jo changes check karega
  handleDomMutations()
  mutationObserver.observe(document.body, {childList: true, subtree: true})
})