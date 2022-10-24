// Search for all H2 objects in the page
var h2 = $(".row").find("h2");
console.log(h2);

// Create a div element for Google ADS
adsDiv = document.createElement("div"),
adsDiv.setAttribute("class", 'ads');
console.log($("h2:nth-of-type(3n)").length);
// If no 3rd H2 found (in case of a short page), than add the DIV before the first H2 block
if ($("h2:nth-of-type(3n)").length == 0) {
    // Add the Google ADS code to the DIV element
    $("h2:nth-of-type(2n)").before(adsDiv);

} else {
    // Add before every 3rd H2 block the DIV element and class
    $("h2:nth-of-type(3n)").before(adsDiv);
}
var adsElements = document.getElementsByClassName("ads");
console.log(adsElements);
$(".ads").append('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8130597253774789" crossorigin="anonymous"></script>')
$(".ads").append('<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8130597253774789" data-ad-slot="6791833895"></ins>')
$(".ads").append('<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>')