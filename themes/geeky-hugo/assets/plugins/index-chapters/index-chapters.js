var h2 = $(".row").find("h2");
adsDiv = document.createElement("div"),
adsDiv.setAttribute("class", 'ads');

$("h2:nth-of-type(3n)").before(adsDiv);
var h2EvenCount = $("h2:nth-of-type(2n)").length
var adsElements = document.getElementsByClassName("ads");

$(adsElements).each(function () {
    $(".ads").append('<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8130597253774789" crossorigin="anonymous"></script>')
    $(".ads").append('<ins class="adsbygoogle" style="display:block; text-align:center;" data-ad-layout="in-article" data-ad-format="fluid" data-ad-client="ca-pub-8130597253774789" data-ad-slot="6791833895"></ins>')
    $(".ads").append('<script> (adsbygoogle = window.adsbygoogle || []).push({});</script>')
});