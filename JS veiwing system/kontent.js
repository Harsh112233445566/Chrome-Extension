
const HANDLE_DOM_MUTATIONS_THROTTLE_MS = 100
let domMutationsAreThrottled = false
let hasUnseenDomMutations = false
const API_RETRY_DELAY = 5000
const MAX_RETRIES_PER_THUMBNAIL = 10
let isPendingApiRetry = false
let thumbnailsToRetry = []
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
const DEFAULT_USER_SETTINGS = {
  barTooltip: true,
  useOnVideoPage: false,
  showPercentage: false,
}

let userSettings = DEFAULT_USER_SETTINGS

function getbookmark(videoData){
  let x=videoData.likes
  let y=videoData.dislikes+1
  let v=videoData.view
  console.log(toString(x));
  let bookmarkelement,bookmarkelement1
    bookmarkelement1 = '<ytrb-bookmark id="'+x+'">' +'<ytb-image>'+'	&#9989;'+'</ytb-image>'+
                    '</ytrb-bookmark>'
    bookmarkelement= '<ytrb-bookmark id="'+x+'">' +'<ytb-image>'+'&#10060;'+'</ytb-image>'+
                    '</ytrb-bookmark>'
  if(x/y>25)
  {
    return '<ytrb-bar style="opacity:1;">' +
      bookmarkelement1+
         '<ytrb-tooltip><div>' + "Dekhne layak" +'</div></ytrb-tooltip>'+
'</ytrb-bar>'}
else {
  return '<ytrb-bar style="opacity:1;">' +
      bookmarkelement+
         '<ytrb-tooltip><div>' + "Samay ki Barbadi" +'</div></ytrb-tooltip>'+
'</ytrb-bar>'
}
  }
function getlikesdislikes(videoData) {
  return '<h5  class="style-scope ytd-video-meta-block ytd-grid-video-renderer ytrb-percentage">'+'&nbsp;|&nbsp;'+'&#128077;'+videoData.likes.toLocaleString()+'&nbsp;|&nbsp;'+'&#128078;'+videoData.dislikes.toLocaleString()+'</h5>'
}
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
        thumbnail = firstChild
      }} else {
      url = $(thumbnail).attr('href')}
    if (!url) {
      return true}
    const previousUrl = $(thumbnail).attr('data-ytrb-processed')
    if (previousUrl) {
     
      if (previousUrl === url) {
        
        if (curTheme === THEME_MOBILE) {
          
          if ($(thumbnail).children().last().is('ytrb-bar')) {
            return true
          }
        } else {
          return true
        }
      } else {
       
        $(thumbnail).children('ytrb-bar').remove()
        $(thumbnail).removeAttr('data-ytrb-retries')
      }
    }
    $(thumbnail).attr('data-ytrb-processed', url)
    const match = url.match(/.*[?&]v=([^&]+).*/)
    if (match) {
      const id = match[1]
      thumbnailsAndVideoIds.push([thumbnail, id])
    }
  })
  return thumbnailsAndVideoIds
}
function getVideoDataObject(likes, dislikes) {
  const total = likes + dislikes
  const rating = total ? likes / total : null
  return {
    likes: likes,
    dislikes: dislikes,
    total: total,
    rating: rating,
  }
}
function retryProcessingThumbnailInTheFuture(thumbnail) {
  thumbnailsToRetry.push(thumbnail)
  if (!isPendingApiRetry) {
    isPendingApiRetry = true
    setTimeout(() => {
      isPendingApiRetry = false
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
function book(thumbnail, videoData) {
  $(thumbnail).append(getbookmark(videoData))
}
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
    for (const oldPercentage of metadataLine.children('.ytrb-percentage')) {
      oldPercentage.remove()}
    if (curTheme === THEME_MOBILE) {
      for (const oldPercentage of metadataLine.children('.ytrb-percentage-separator')) {
        oldPercentage.remove()
      }}
    if (videoData.rating != null && !(videoData.likes === 0 && videoData.dislikes >= 10)) {
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
      }}}}
function processNewThumbnails() {
  const thumbnails = getNewThumbnails()
  const thumbnailsAndVideoIds = getThumbnailsAndIds(thumbnails)
  for (const [thumbnail, videoId] of thumbnailsAndVideoIds) {
    getVideoData(thumbnail, videoId).then(videoData => {
      if (videoData !== null) {
        if (userSettings.barHeight !== 0) {
          book(thumbnail, videoData)
        }
        if (userSettings.showPercentage) {
          likesanddislikes(thumbnail, videoData)
        }}})}}
const NUMBERING_SYSTEM_DIGIT_STRINGS = ["0123456789",]
function parseInternationalInt(string) {
  string = string.replace(/[\s,.]/g, "")
  if (/[^0-9]/.test(string)) {
    let newString = ""
    for (const char of string) {
      for (const digitString of NUMBERING_SYSTEM_DIGIT_STRINGS) {
        const index = digitString.indexOf(char)
        if (index !== -1) {
          newString += index
          break}}}
    string = newString}
  return parseInt(string, 10)
}


function updateVideoRatingBar() {
  $('.ryd-tooltip').each(function(_, rydTooltip) {
    const tooltip = $(rydTooltip).find('#tooltip')
    const curText = $(tooltip).text()

    if (!curText.endsWith('\u200b')) {
      const videoData = getVideoDataFromTooltipText(curText)

      if (userSettings.barTooltip && videoData) {
        $(tooltip).text(`${curText} \u00A0\u00A0 ` +
          `${ratingToPercentage(videoData.rating ?? 0)} \u00A0\u00A0 ` +
          `${videoData.total.toLocaleString()} total\u200b`)
      } else {
        $(tooltip).text(`${curText}\u200b`)
      }

      if (userSettings.useExponentialScaling && videoData && videoData.rating) {
        $(rydTooltip).find('#ryd-bar')[0].style.width =  exponentialRatingWidthPercentage(videoData.rating) + '%'
      }
    }
  })
}
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

chrome.storage.sync.get(DEFAULT_USER_SETTINGS, function(storedSettings) {
  if (storedSettings) {
    userSettings = storedSettings
  }
  const cssFiles = []
    cssFiles.push('css/bar.css')
      cssFiles.push('css/bar-bottom.css')
      cssFiles.push('css/bar-tooltip.css')
        cssFiles.push('css/bar-bottom-tooltip.css')
      cssFiles.push('css/bar-video-page.css')
    chrome.runtime.sendMessage({
      query: 'insertCss',
      files: cssFiles,
    })
  handleDomMutations()
  mutationObserver.observe(document.body, {childList: true, subtree: true})
})