/* 
 * Based on:
 * 
 * List all attachments when clicking the paperclip
 * ---------------------------------------------
 * Created by Alexander Bautz
 * alexander.bautz@gmail.com
 * http://sharepointjavascript.wordpress.com
 * Copyright (c) 2010-2012 Alexander Bautz (Licensed under the MIT X11 License)
 * v1.7 for SharePoint 2010
 * LastMod: 05.06.2012
 * ---------------------------------------------
 * Include reference to:
 * jquery - http://jquery.com
 * ---------------------------------------------
 */
 
/*
 * Edited by Daniel Stoelzner
 * daniel.stoelzner@gmail.com
 * http://spoodoo.com
 * 
 * Blog Article: http://spoodoo.com/open-list-item-attachments-by-clicking-the-paperclip-version-2/
 *
 * v2.5.0BETA1 for SharePoint 2013 and SharePoint Online
 * Last Modification: June 1st, 2015
 * 
 * Instructions:
 * 1. Place the code in a CEWP or Script Editor Webpart or reference the script-file
 *    in any of these web parts or on your master page
 * 2. You can customize the look or behaviour with the following code:
 *    var argObj = {clickToOpen: false,
 *                  clickMouseover: 'Click to open',
 *                  oneClickOpenIfSingle: false,
 *                  hideIdColumn: false,
 *                  colorGradientStart: 'white',
 *                  colorGradientEnd: 'white',
 *                  colorFont: 'auto',
 *                  borderColor: 'black',
 *                 };
 * 3. ID column must be present for server-rendered views aka Newsletter style, Shaded style, etc.
 *    You can hide the ID column again via the hideIdColumn-property of argObj.
 * 4. Depends on jQuery: http://jquery.com
 */

jQuery(function () {
	if(typeof asyncDeltaManager != "undefined"){
		asyncDeltaManager.add_endRequest(listAttachments)
	} else { 
		listAttachments();
	}
}); 
function listAttachments(){
	window.LAListContainer = [];
	function findListsAndAttachHandlers(){
		jQuery("div#contentBox div[id^='WebPartWPQ']:not(div[id$='_ChromeTitle']):has(.ms-listviewtable)").each(function () {
			var list = new List(jQuery(this));
			window.LAListContainer.push(list);
			list.listAttachmentInit();
			list.list.data("listAttachmentsData", list)
		});
		var ReRenderListView_old = ReRenderListView;
		ReRenderListView = function (b, l, e) {
			ReRenderListView_old(b, l, e);
			jQuery("#WebPart" + b.wpq).data("listAttachmentsData").listAttachmentInit()
		};
		var ExpCollGroup_old = ExpCollGroup;
		ExpCollGroup = function (c, F, y, w) {
			ExpCollGroup_old(c, F, y, w);
			var tbodId = ("#tbod" + c + "_");
			var interval = setInterval(function () {
				var tbod = jQuery(tbodId)
				if(tbod.attr("isloaded") == "true") {
					tbod.closest("[id^=WebPartWPQ]").data("listAttachmentsData").listAttachmentInit();
					clearInterval(interval)
				}
			}, 100)
		}
	}
	function List(list){
		this.list = list;
		var _self = this;
		this.listAttachmentInit = function(){
			this.listType = this.list.find('.ms-listviewgrid').length ? "Grid" : "NormalList";
			this.thisListCTX = SP.Ribbon.NativeUtility.getCtxForView("{" + this.list.attr("webpartid").toUpperCase() + "}");
			var _thisListCTX = this.thisListCTX;
			if(this.thisListCTX.listBaseType == 0){
				if(this.thisListCTX.ListSchema != null){
					for(var i = 0; i < this.thisListCTX.ListSchema.Field.length; i++){
						if(this.thisListCTX.ListSchema.Field[i].FieldType == "Attachments"){
							var headerRow = this.listType == "NormalList" ? list.find(".ms-viewheadertr") : this.list.find(".ms-listviewgrid .ms-viewheadertr");
							if(this.listType == "NormalList"){
								attachmentColumnIndex = headerRow.find("th:has(div[fieldtype='Attachments'])").index()
							} else {
								attachmentColumnIndex = headerRow.find("th[title='Attachments']").index()
							}
							list.find(".ms-listviewtable:visible > tbody > tr[role=row]:visible").each(function () {
								var thisRow = jQuery(this);
								if (thisRow.find(">td:eq(" + attachmentColumnIndex + ") img").length > 0) {
									_self.attachEventListener(this, attachmentColumnIndex, thisRow.attr("iid").split(",")[1], _thisListCTX.listName)
								}
							});
							return
						}
					}
				} else {
					var headerRow = list.find(".ms-viewheadertr");
					var idColumnIndex = headerRow.find("th:has(div[name='ID'])").index();
					var attachmentColumnIndex = headerRow.find("th:has(div[fieldtype='Attachments'])").index();
					if(idColumnIndex > -1 && attachmentColumnIndex > -1){
						this.list.find(".ms-listviewtable > tbody > tr:nth-child(n+2)").each(function(){
							var thisRow = jQuery(this);
							if(thisRow.find(">td:eq(" + attachmentColumnIndex + ") img").length){
								_self.attachEventListener(this, attachmentColumnIndex, thisRow.find("> td").eq(idColumnIndex)[0].innerText, _thisListCTX.listName);
								if(argObj.hideIdColumn){
									thisRow.find("> th,> td").eq(idColumnIndex).hide()
								}
							}
						})
					}
				}
			}
		}
		this.showAttachments = function (element, itemID, listGuid) {
			var _self = this
			element = jQuery(element);
			var bubbleMarkup = "";
			var additionalOffsetTop = 0;
			var allAttachments = {
				count: 0,
				items: []
			};
			jQuery.ajax({
				url: L_Menu_BaseUrl + "/_api/web/lists(guid'" + listGuid.slice(1, -1) + "')/items('" + itemID + "')/AttachmentFiles",
				method: "GET",
				async: false,
				headers: { "Accept": "application/json; odata=nometadata" },
				success: function (data) {
					jQuery(data.value).each(function () {
						allAttachments.items.push({
							extension: this.FileName.substring(this.FileName.lastIndexOf('.') + 1),
							name: this.FileName,
							fullPath: this.ServerRelativeUrl
						});
						allAttachments.count++;
					});
				}
			});
			if(allAttachments.count > 0) {
				if(allAttachments.count === 1 && argObj.clickToOpen && argObj.oneClickOpenIfSingle) {
					var openOk = ViewDoc(allAttachments.items[0].fullPath, 'SharePoint.OpenDocuments.3');
					if(!openOk) {
						window.open(url, "_blank", "status=0,toolbar=0,resizable=1");
					}
					return
				} else {
					additionalOffsetTop = 38 + ((allAttachments.count - 1) * 18);
					jQuery.each(allAttachments.items, function (i, item) {
						bubbleMarkup += "<div id='attachmentContainer_" + i + "'>";
						bubbleMarkup += "<img id='attachmentIcon_" + i + "' src='/_layouts/images/ic" + item.extension + ".gif'>&nbsp;";
						bubbleMarkup += "<a id='attachmentLink_" + i + "' href='" + item.fullPath.replace(/'/g,"&apos;") + "' target='_blank'>" + item.name + "</a></div>";
					});
				}
			} else {
				return
			}
			jQuery("#attachmentInnerBubble").html(bubbleMarkup);
			var positionTop = element.offset().top - additionalOffsetTop;
			var positionLeft = element.offset().left - 23;
			var outerBubble = jQuery("#outerBubble");
			var wrapperWidth = outerBubble.width();
			if((positionLeft + wrapperWidth + 25) > jQuery('#s4-workspace').width() ){
				positionLeft = element.offset().left - (wrapperWidth - 32);
				jQuery('	<style id="tempcss">' +
								'#attachmentInnerBubble::after,#outerBubble::after{' +
									'left: ' + (wrapperWidth - 32) + 'px !important' +
								'}' +
								'#attachmentInnerBubble::before{' +
									'left: ' + ((wrapperWidth - 32) - 35) + 'px !important' +
								'}' +
							'</style>')
				.appendTo('head');
			}
			jQuery("[id^=attachmentIcon_]").on("error", function (event) {
				jQuery(event.target).attr("src", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXN" +
					"SR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAYdEVYdFNvZnR3YXJlAHBhaW50Lm5ldCA0LjAuO" +
					"Wwzfk4AAADmSURBVDhPrc7basJAFIXhvIIvlhcL3vQpvJReFUEQCoJgKVKt1Ho22EpFU8lxJsnfGUqLlRin4IZ1M3vWx7YAi8rN/6N" +
					"7KtcBHMehKLZtU1jWOQVO5+ftLGIK6ClEygCZfgO6eJyLQJ6DUGU/ztkFGdWm95uLQKbKsYRDlLH1U9y9ZPIh6K+FGRCKHE+VN4eU5" +
					"U4y2gh6bkJnHpsB+uT1Z8psKxi+JzyuEtrTiOZLaAa4nmSsTh68JXQXMffjiMYw5PYpMAOOT269Rtw9h9R7AbUH3wzQn8pSCuilSc4" +
					"CfxamuQ6A9QUUI42VXJrEygAAAABJRU5ErkJggg==");
			});
			outerBubble.css({
				top: positionTop,
				left: positionLeft
			})
			.mouseenter(function(){
				jQuery(this).addClass("hover")
			})
			.fadeIn(200)
			outerBubble.find("#attachmentInnerBubble").bind("mouseout", function(e){
				_self.hideAttachments(e)
			})
			setTimeout(function () {
				if(!outerBubble.hasClass("hover")){
					_self.hideAttachments(this);
				}
			}, 200);
		}
		this.hideAttachments = function hideAttachments(e) {
			var relatedTargetID = jQuery(e.relatedTarget).attr('id');
			if(typeof relatedTargetID == "undefined" || relatedTargetID.match(/^attachment/g) == null){
				jQuery("#outerBubble").removeClass("hover").hide();
				jQuery('#tempcss').remove();
			}
		}
		this.attachEventListener = function (element, attachmentColumnIndex, itemID, listGuid){
			var _self = this
			if(argObj.clickToOpen) {
				jQuery(element).find(">td:eq(" + attachmentColumnIndex + ") img")
				.attr('title', argObj.clickMouseover)
				.css('cursor', 'pointer')
				.off("click")
				.on("click", function () {
					_self.showAttachments(this, itemID, listGuid);
				});
			} else {			
				jQuery(element).find(">td:eq(" + attachmentColumnIndex + ") img")
				.off("mouseover")
				.on("mouseover", function () {
					_self.showAttachments(this, itemID, listGuid);
				});
			}
		}
	}
	(function () {
		if(!jQuery("#MSOLayout_InDesignMode").val() && !jQuery("#_wikiPageMode").val()){
			if(typeof argObj == "undefined") argObj = {};
			var argObjPlaceHolder = {
				clickToOpen: false,
				clickMouseover: 'Click to open',
				oneClickOpenIfSingle: false,
				hideIdColumn: false,
				colorFont: 'auto',
				colorGradientStart: 'white',
				colorGradientEnd: 'white',
				borderColor: 'grey'
			};
			argObj = jQuery.extend(argObjPlaceHolder, argObj);
			if(jQuery.inArray("spgantt.js", g_spPreFetchKeys) > -1) {
				ExecuteOrDelayUntilScriptLoaded(function () {
					setTimeout(function () {
						findListsAndAttachHandlers();
					}, 0)
				}, "spgantt.js")
			} else {
				findListsAndAttachHandlers();
			}
			var style = "#attachmentInnerBubble {" +
						"  box-shadow: 3px 3px 6px rgba(0, 0, 0, 0.3);" +
						"  position: relative;" +
						"  padding: 5px;" +
						"  background:" + argObj.colorGradientStart + ";" +
						"  background:-webkit-gradient(linear, 0 0, 0 100%, from(" + argObj.colorGradientStart + "), to(" + argObj.colorGradientEnd + "));" +
						"  background:-moz-linear-gradient(" + argObj.colorGradientStart + ", " + argObj.colorGradientEnd + ");" +
						"  background:-o-linear-gradient(" + argObj.colorGradientStart + ", " + argObj.colorGradientEnd + ");" +
						"  background:linear-gradient(" + argObj.colorGradientStart + ", " + argObj.colorGradientEnd + ");" +
						"  border-radius:5px;" +
						"  cursor: pointer;" +
						"  z-index: 999;" +
						"}" +
						"#attachmentInnerBubble a {" +
						"  color: " + argObj.colorFont + ";" +
						"}" +
						"#attachmentInnerBubble:before, #outerBubble:before {" +
						"  content: '';" +
						"  position: absolute;" +
						"  bottom: -25px;" +
						"  left: 15px;" +
						"  height: 30px;" +
						"  width: 35px; " +
						"}" +
						"#attachmentInnerBubble:after {" +
						"  content: '';" +
						"  position: absolute;" +
						"  bottom: -10px;" +
						"  left: 23px;" +
						"  border-width: 11px 6px 0;" +
						"  border-style:solid;" +
						"  border-color:" + argObj.colorGradientEnd + " transparent;" +
						"}" +
						"#outerBubble {" +
						"  display: none;" +
						"  position: fixed;" + 
						"  padding: 1px;" +
						"  background-color: " + argObj.borderColor + ";" +
						"  border-radius: 6px;" +
						"  z-index: 998" +
						"}" +
						"#outerBubble:after {" +
						"  content: '';" +
						"  position: absolute;" +
						"  left: 23px;" +
						"  border-width: 11px 7px 0;" +
						"  border-style:solid;" +
						"  border-color: " + argObj.borderColor + " transparent;" +
						"}" +
						"div[id^='attachmentContainer_'] {" +
						"  font-size: 11px;" +
						"  padding: 1px;" +
						"  white-space: nowrap;" +
						"}" +
						"img[id^='attachmentIcon_'] {" +
						"  vertical-align: middle;" +
						"  height: 16px;" +
						"  width: 16px;" +
						"}";
			var div = jQuery("<div />", {
				html: '&shy;<style>' + style + '</style>'
			}).appendTo("body");
			jQuery("div#contentBox").prepend(
				"<div id='outerBubble'>" +
					"<div id='attachmentInnerBubble'></div>" +
				"</div>"
			);
		}
	})()
}
