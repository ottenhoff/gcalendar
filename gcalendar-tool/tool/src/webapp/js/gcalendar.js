/*
 getGoogleCalendar
 Notes: The Math.floor((Math.random()*100)+1) in the ajax calls are to make sure that Internet Explorer 8 and 9
 do not return the cached values for similar calls. In theory, using cached:false should take care of this issue,
 but, it did not in some of my earlier testing so I left it in.
 */

//The default colors are set in library/src/webapp/fullcalendar/fullcalendar.css
var WHITE = '#FFFFFF';
var EVENT_BACKGROUND_COLOR = '#3366CC'; // a light-ish blue to be compatible with the previous version

var eventArray = []; // move globally

var editable;
var createEvents;

var busy = "busy";

var eventTimeValueArray = ["00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00", "03:30", "04:00", "04:30", "05:00", "05:30", 
                           "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
                           "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", 
                           "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30"];
                                
var eventTimeTextArray = ["12:00am", "12:30am", "1:00am", "1:30am", "2:00am", "2:30am", "3:00am", "3:30am", "4:00am", "4:30am", "5:00am", "5:30am", 
                          "6:00am", "6:30am", "7:00am", "7:30am", "8:00am", "8:30am", "9:00am", "9:30am", "10:00am", "10:30am", "11:00am", "11:30am", 
                          "12:00pm", "12:30pm", "1:00pm", "1:30pm", "2:00pm", "2:30pm", "3:00pm", "3:30pm", "4:00pm", "4:30pm", "5:00pm", "5:30pm", 
                          "6:00pm", "6:30pm", "7:00pm", "7:30pm", "8:00pm", "8:30pm", "9:00pm", "9:30pm", "10:00pm", "10:30pm", "11:00pm", "11:30pm"];

var EVENT_TITLE_MAX_SIZE = 60;
var CNTL_KEY_EVENT_KEYCODE_13 = 13;

// Variable to manage the Google event pop-up window.
var gCalPopUpHandle; // Handle to GCal pop-up window.
var intervalHandle; // Handle to timer service that checks if pop-up has closed.

// Compare two events dates/times.
var compare_two_events = function (evt1, evt2) {
	
	if (evt1.isAfter(evt2)) {return 1;}
	if (evt1.isBefore(evt2)) {return -1;}
	return 0;
	};

// Sort both allDay and non-allDay events by start date. Sorting is done so tabbing through the events
// in the calendar happens chronologically.
var sort_calendar_events_by_start_date = function(evt1, evt2){

    if (evt1.start.date && evt2.start.date){ // Both events are allDay events.
    	return compare_two_events(moment(evt1.start.date), moment(evt2.start.date));
    }
    else if (evt1.start.dateTime && evt2.start.dateTime){ // Both events are non-allDay events.
    	return compare_two_events(moment(evt1.start.dateTime), moment(evt2.start.dateTime));
    } // One allDay event and one non-allDay event.
    else if (evt1.start.date && evt2.start.dateTime){
    	return compare_two_events(moment(evt1.start.date), moment(evt2.start.dateTime));
    }
    else{
    	return compare_two_events(moment(evt1.start.dateTime), moment(evt2.start.date));
    }
};

// Function used to update some of the fullcalendar form elements to help improve accessibility.
var decorateControlsForAccessibility = function(){
    
	decorateButtonsForAccessibility();
	addListenerToEventLinks();
	initializeControlsToAddEvent();
    
};

// Modify navigation and view buttons so we can tab to them and select them with the enter key.
var decorateButtonsForAccessibility = function(){
	// Buttons we desire to access via the keyboard
    $('.fc-button-next').html(lang.langdata.buttonNext);
    $('.fc-button-prev').html(lang.langdata.buttonPrev);
    $('.fc-button-today').html(lang.langdata.buttonToday);
    $('.fc-button-month').html(lang.langdata.buttonMonth);              
    $('.fc-button-agendaDay').html(lang.langdata.buttonDay);
    $('.fc-button-agendaWeek').html(lang.langdata.buttonWeek); 
};

// Capture user input date and validation.
var initializeControlsToAddEvent = function(){

    // Add handler to "new event" button so user can add event with keyboard.
    $('.newEventButton').on("click", function(e){
    	var userEnteredDate = $('#newEventDateField').val();
    	
    	if (userEnteredDate === null || userEnteredDate.trim() ===""){
    	    alert(lang.langdata.dateRequired);
    	    return;
    	}
    	// Validate date format
    	var eventDate = moment(userEnteredDate, "MM-DD-YYYY");
    	if (!eventDate.isValid()){
    		alert(lang.langdata.invalidDateFormat);
    		return;
    	}
    	// Should have a valid date now in expected format
    	var validEventDate = new Date(userEnteredDate);
        displayNewEventDialog(validEventDate, true);
    });
};

// Modify table to provide additional information for accessibility.
var decorateTableForAccessibility = function(){
	var view = $('#calendar').fullCalendar('getView');
	// Fullcalendar does not provide a caption for the table so we add one when page loads.
	// As the user navigates through different views we update the caption text to reflect the current view.

	var captionText = lang.langdata.calendarViewTitle.replace('%1', view.name).replace('%2', view.title.replace('&#8212;', '-'));
	
	if ($('.fc-header caption').length === 0){
		$('.fc-header').prepend('<caption class="skip">' + captionText + '</caption>');
	}
	else{
		$('.fc-header caption').text(captionText );
	}
	setFocusOnTitle();
};

//Add event handler to capture user hitting the "enter" key on a calendar event.
var addListenerToEventLinks = function(){
    $(document).on('keydown', '.fc-event', function(e){ // keypress did not work with Chrome. Had to use keydown.
    	
    	// We are listening for Enter to launch the pop-up in the real Google calendar because the fullCalendar  
    	// is trapping all events, allowing only onclicks).
        if(e.which === CNTL_KEY_EVENT_KEYCODE_13) {
            e.preventDefault();
            var url = $(this).attr('href');
            gCalPopUpHandle = window.open(url, 'eventDetail', config = 'height=700,width=600');
            if (window.focus) {
            	gCalPopUpHandle.focus();
            }
        }
    });	
};

// Consistently set focus on title after changes in view or navigation.
var setFocusOnTitle = function(){
	$('.fc-header-title h2').attr('tabIndex', '-1'); // -1 means element gets skipped when tabbing through the form.
	$('.fc-header-title h2').focus();
};

// Handles the display of error messages in the new event dialog.
var displayNewEventDialogErrorMessage = function(errorMessage){
    $("#newEvent").prepend("<p class=\"messageValidation\" style=\"height:20px\" >" + errorMessage + "</p>");
    $("#newEvent .messageValidation").attr("tabindex", "0"); // Tabindex required to set focus on a <p> tag.
    $("#newEvent .messageValidation").focus();
};

var displayNewEventDialog = function(date, allDay){
	
	if ( editable === false || createEvents === false )
    	return false;
	
    var $dialogDiv = $('<div id="newEvent"></div>').appendTo(document.body);
    $dialogDiv.html($('.newEventTemplate').html());               
    
    // need to remove the event so there are not two fields with the same name on the page (for accessibility)
    var temp = $('.newEventTemplate').html();
    $('.newEventTemplate').html("");

    $dialogDiv.dialog({
        width : 580,
        height : 400,
        position : "center",
        autoOpen : true,
        modal : true,
        draggable : true,
        resizable : false,
        title : "New Event",
        close : function(event, ui) {
            // Clean up: remove dialog, its children, and the events from DOM
            $('#newEvent').remove(); 
            // when we are all done, put the template back
            $('.newEventTemplate').html(temp);
        }
    });
    
    $("#newEvent .newEventDate").text(date.yyyymmdd());          
   
    if (allDay) {
        $("#newEvent .newEventAllDay").attr("checked", true);
        $("#newEvent .newEventTimeClass").hide();                 
    } else {
        $("#newEvent .newEventAllDay").attr("checked", false);
        $("#newEvent .newEventTimeClass").show();
                         
        var eventStartTimeValue = date.toRFC3339().substring(11, 16);
        var eventEndTimeValue = date.addHours(1).toRFC3339().substring(11, 16);
        
        var eventStartTimeText = getEventTimeText(eventStartTimeValue);
        var eventEndTimeText = getEventTimeText(eventEndTimeValue);
        
        // Initialize the timepickers.
        $('#newEventStartTime').timepicker({'minTime': eventStartTimeText});
        $('#newEventEndTime').timepicker({'minTime': eventStartTimeText, 'showDuration': true});
        
        // Update the entry fields on the page with the time values.
        $('#newEventStartTime').val(eventStartTimeText);
        $('#newEventEndTime').val(eventEndTimeText);
    }
    
    // Event handler for changes in start time; need to update the end time picker
    $("#newEventStartTime").on("change", function(){
    	var startTimeValue = $(this).val(); 
    	$('#newEventEndTime').timepicker('option', {'minTime' : startTimeValue, 'showDuration': true}); 
    });
    
    // event handler for checkbox
    $("#newEvent .newEventAllDay").on("click", function(e) {                                                       
        if ($("#newEvent .newEventAllDay:checked").length) {
            $("#newEvent .newEventTimeClass").hide();
        } else {
            $("#newEvent .newEventTimeClass").show();
            // Initialize the time pickers.
            $('#newEventStartTime').timepicker({'scrollDefaultNow':true}); 
            $('#newEventEndTime').timepicker({'scrollDefaultNow':true}); 
        }                    
    });
    // There is currently no visual clue that focus is on the all day checkbox so we add these focus related handlers to help.
    $("#newEvent .newEventAllDay").on("focus", function(e){
    	$('label[for="newEventAllDay"]').addClass("checkboxHighlighter");
    });
    $("#newEvent .newEventAllDay").on("focusout", function(e){
    	$('label[for="newEventAllDay"]').removeClass("checkboxHighlighter");
    });
 
    // event handler for create event button
    $("#newEvent .newEventSave").on("click", function(e) {
        var eventSummary = $("#newEvent .newEventTitle").val();
        var tmpEventStartTimeValue = $("#newEventStartTime").val();
        var tmpEventEndTimeValue = $("#newEventEndTime").val(); 
        
        allDay = false;
        if ($("#newEvent .newEventAllDay:checked").length) {
        	allDay = true;
        }
        
        if ( !allDay ) {
        	var eventEndTimeValue = getEventTimeValue(tmpEventEndTimeValue );    
            if ( eventEndTimeValue < 0 ) {
            	$("#newEvent .messageValidation").remove();
            	displayNewEventDialogErrorMessage(lang.langdata.invalidEndTime);
                return;
            }
            var eventStartTimeValue = getEventTimeValue(tmpEventStartTimeValue );
            if ( eventStartTimeValue < 0 ) {
            	$("#newEvent .messageValidation").remove();
            	displayNewEventDialogErrorMessage(lang.langdata.invalidStartTime);
                return;
            }
        }
        // make sure end is after start
        if ( ( eventEndTimeValue < eventStartTimeValue ) && ( !allDay ) ) {
        	$("#newEvent .messageValidation").remove();
        	displayNewEventDialogErrorMessage(lang.langdata.startBeforeEndTime);
        } else {
            var tempString = eventSummary.replace(/^\s+|\s+$/g, ""); // trim
            var eventSummary1 = tempString.replace(/'/g, "\\'"); // escape '

            if (eventSummary1 == null || eventSummary1 == "") {
                eventSummary1 = "No title";
            }
            processSave(eventSummary1, eventStartTimeValue, eventEndTimeValue, userTimeZone);
        }
    });	

    processSave = function(eventSummaryValue, eventStartTimeValue, eventEndTimeValue, userTimeZone) {	   
        var data2;
        var starttime;
        var endtime;
        var json;
        var jsonContext;
        
        // if it is all day event
    	if ($("#newEvent .newEventAllDay:checked").length) {
    		starttime = date.yyyymmdd();
    		endtime = date.addHours(24).yyyymmdd();		
    		data2 = "{'end': {'date': '" + endtime + "'},'start': {'date': '" + starttime + "'},'summary': '" + eventSummaryValue + "'}";
    	} else {
    		starttime = date.yyyymmdd();
    		endtime = date.yyyymmdd();
    		starttime = starttime + "T" + eventStartTimeValue + ":00";
            endtime = endtime + "T" + eventEndTimeValue + ":00";
    		data2 = "{'end': {'dateTime': '" + endtime + "', 'timeZone':'"+ userTimeZone + "'},'start': {'dateTime': '" + starttime + "', 'timeZone':'"+ userTimeZone + "'},'summary': '" + eventSummaryValue + "'}";
    	}               	

    	json = "json";
		jsonContext = "application/json";
    	
        jQuery.ajax({
            type : "POST",
            contentType : jsonContext,
            data : data2,
            url : baseUrl + '/' + proxyName + '/calendar/v3/calendars/' + gcalid + '/events?access_token=' + accesstoken +'&amp;' + Math.floor((Math.random()*100)+1),
            dataType : json,
            async: false, // when true, you can get multiple events created
            cache: false,
            timeout: 5000,

            // if ajax call success
            success : function(datain) {
                // close dialog
                $("#newEvent").dialog("close"); 
                var startdate;
                var enddate;
                var allday;

                if (null != datain.start ) { 
                	if ( null != datain.start.dateTime) { 
                        startdate = datain.start.dateTime;
                        enddate = datain.end.dateTime;
                        allday = false;
                    } else {
                        startdate = datain.start.date;
                        //enddate = new Date(datain.end.date); // Do not set the enddate because it causes repeating events
                        allday = true; 
                    }
            	} else { 
                	allday = true;
            	} 

                $('#calendar').fullCalendar('renderEvent', {
                    id : datain.id,
                    title : datain.summary,
                    start : startdate,
                    end : enddate,
                    url : datain.htmlLink,
                    description : datain.description,
                    location : datain.location,
                    allDay : allday
                }, false // 'stick' flag
                );
                
                // load info into eventArray
                eventArray.push({
                    id : datain.id,
                    title : datain.summary,
                    start : startdate,
                    end : enddate,
                    url : datain.htmlLink,
                    description : datain.description,
                    location : datain.location,
                    allDay : allday,
                    sequence : datain.sequence,
                    recurrence : datain.recurrence,
                    recurringEventId : datain.recurringEventId
                });
            },

            // if ajax call failed
            error : function(XMLHttpRequest, textStatus, errorThrown) {
                $("#newEvent .messageValidation").remove();
                displayNewEventDialogErrorMessage(lang.langdata.errorCreatingEvent);
                //alert( "creating event failed " + textStatus + " " + errorThrown ); // TODO: distinguish between end before start
                // and AJAX error
            }
        });  
    };

};


// Show spinner whenever async activity takes place
$(document).ready(function() {
	$(document).ajaxStart(function(){
		$('#spinner').show();
	});
	$(document).ajaxStop(function(){
		$('#spinner').hide();
	});
	
});

getGoogleCalendar = function(accesstoken, gcalid) {
	// viewDetailsAllowed is a String
	editable = true;
	if ( viewDetailsAllowed == "false")
		editable = false;
	
	// createEventsAllowed is a String
	createEvents = true;
	if ( createEventsAllowed == "false")
		createEvents = false;
	
	// gcalview is a String (permission gcal.view - show no details)
	viewbusyOnly = false;
	if ( gcalview == "false")
		viewbusyOnly = true;
	
    $('#calendar').fullCalendar({

        theme : true,       
        editable : editable, // allows or prohibits drag and drop (not event edit)
        header : {
            left : 'today prev,next',
            center : 'title',
            right : 'month,agendaWeek,agendaDay'
        },

		eventRender: function(event, element) {	
			$(element).attr('title', event.title);	// Provide a tool tip for the event title.
			
        	// Event titles can be long in month view so we truncate the text and provide the complete text
        	// through the tool tip.
			var title = element.find('.fc-event-title');
        	var view = $('#calendar').fullCalendar('getView');
        	if (title.text().length > EVENT_TITLE_MAX_SIZE && view.name == 'month'){
        		var more = "<span class='moreInfo'>&nbsp;(more...)</span>";
        		title.text(title.text().substr(0,EVENT_TITLE_MAX_SIZE)); // Truncate the title text.
        		title.append(more);	// Add indicator that there is more text available if user mouses over.
        	}
		},

		eventAfterAllRender: function(view){
			decorateTableForAccessibility();
		},
		
        // get all the events in the given time range from google calendar
        events : function(start, end, callback) { 
        	refreshCalendarItems( start, end, callback );
        },
        
        eventBackgroundColor : EVENT_BACKGROUND_COLOR,
        
        eventTextColor : WHITE,
        
        // drop an existing event in full calendar (NOTE: does not work in IE9)
        eventDrop: function(event,dayDelta,minuteDelta,allDay,revertFunc) {

            var index = findFullCalendarEvent( event );
            var data2;
            var starttime;
            var endtime;
            
            if ( editable === false )
            	return;
            	
            if ( index >= 0 ) {
                var sequence = eventArray[index].sequence;
                
            	if (event.allDay) {
            		starttime = event.start.yyyymmdd();
            		endtime = event.start.yyyymmdd();
            		// need to update the sequence
            		data2 = "{'end': {'date': '" + endtime + "'},'start': {'date': '" + starttime + "'},'sequence':'" + sequence +"','summary': '" + event.title  + "'}";
            	} else {
            		starttime = event.start.yyyymmdd();
            		endtime = event.end.yyyymmdd();
            		
            		var eventStartTimeValue = event.start.toRFC3339().substring(11, 16);
                    var eventEndTimeValue = event.end.toRFC3339().substring(11, 16);
                    
            		starttime = starttime + "T" + eventStartTimeValue + ":00";
                    endtime = endtime + "T" + eventEndTimeValue + ":00";
            		data2 = "{'end': {'dateTime': '" + endtime + "', 'timeZone':'"+ userTimeZone +"'},'start': {'dateTime': '" + starttime + "', 'timeZone':'"+ userTimeZone +"'},'sequence':'" + sequence +"','summary': '" + event.title  + "'}";
            	}
            	var eventID = event.id;

            	// PUT https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId} // from google cal docs
            	jQuery.ajax({
                    type : "PUT",
                    contentType : "application/json",
                    data : data2,
                    url : baseUrl + '/' + proxyName + '/calendar/v3/calendars/' + gcalid + '/events/' + eventID + '/?access_token=' + accesstoken + '&amp;' + Math.floor((Math.random()*100)+1),
                    dataType : "json",
                    async: true,
                    cache: false,

                    // if ajax call success
                    success : function(datain) {
                    	
                    },
                    
            		error : function(XMLHttpRequest, textStatus, errorThrown) {
            			var errorMessage = lang.langdata.updateEventFailed;
                        alert( errorMessage.replace('%1',textStatus).replace('%2', errorThrown) );
                        revertFunc();
            		}
            	});
            } else {
            	alert(lang.langdata.eventNotFound);
            }
           
        },
        
        // resize event i.e. change the duration of an event that has time (NOTE: Does not work in IE9)
        eventResize: function(event,dayDelta,minuteDelta,revertFunc) {

            var index = findFullCalendarEvent( event );
            var data2;
            var starttime;
            var endtime;
            
            if ( editable === false )
            	return false;
            
            // if the event is a recurring event,
            if ( event.recurrence || event.recurringEventId ) {
            	alert( "Recurring events can be edited in the full version of Google Calendar");
            	// revert to the original timeframe
            	revertFunc();
            	// opens events in a popup window
                window.open(event.url, 'gcalevent', 'width=700, height=600');
                return false;
            }
            if ( index >= 0 ) {
                var sequence = eventArray[index].sequence;
                
            	if (event.allDay) {
            		starttime = event.start.yyyymmdd();
            		endtime = event.start.yyyymmdd();
            		// Changing an event requires a new sequence (done in findFullCalendarEvent)
            		data2 = "{'end': {'date': '" + endtime + "'},'start': {'date': '" + starttime + "'},'sequence':'" + sequence +"','summary': '" + event.title  + "'}";
            	} else {
            		starttime = event.start.yyyymmdd();
            		endtime = event.end.yyyymmdd();
            		
            		var eventStartTimeValue = event.start.toRFC3339().substring(11, 16);
                    var eventEndTimeValue = event.end.toRFC3339().substring(11, 16);
                    
            		starttime = starttime + "T" + eventStartTimeValue + ":00";
                    endtime = endtime + "T" + eventEndTimeValue + ":00";
            		data2 = "{'end': {'dateTime': '" + endtime + "', 'timeZone':'"+ userTimeZone +"'},'start': {'dateTime': '" + starttime + "', 'timeZone':'"+ userTimeZone +"'},'sequence':'" + sequence +"','summary': '" + event.title  + "'}";
            	}
            	var eventID = event.id;

            	// PUT https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId} // from Google cal docs
            	jQuery.ajax({
                    type : "PUT",
                    contentType : "application/json",
                    data : data2,
                    url : baseUrl + '/' + proxyName + '/calendar/v3/calendars/' + gcalid + '/events/' + eventID + '/?access_token=' + accesstoken + '&amp;' + Math.floor((Math.random()*100)+1),
                    dataType : "json",
                    async: false,
                    cache: false,

                    success : function(datain) {
                    	//alert( "event updated" );
                    },
                    
            		error : function(XMLHttpRequest, textStatus, errorThrown) {
                        alert( "Updating calendar event failed " + textStatus + " " + errorThrown );
            		}
            	});
            } else {
            	alert(lang.langdata.eventNotFound);
            }
        },
   
        // click the existing event in google calendar
        eventClick : function(event) {
        	if ( editable === false )
            	return false;
        	
            // opens events in a popup window
    		gCalPopUpHandle = window.open(event.url, 'gcalevent', 'width=700, height=600');
    		clearInterval(intervalHandle);	// If user re-clicks the event link.
    		gCalPopUpHandle.focus();	// If user re-clicks the event link.
        	// If user can update events, we monitor for the Google window closing so we can refresh
        	// the page and display any updates made to the event.
        	if (createEventsAllowed == "true"){
        		intervalHandle = setInterval(checkIfPopUpIsClosed, 200); // Check 5 times a second
        	}
            return false;
        },

        // create an event in a day
        dayClick : function(date, allDay, jsEvent, view) {
        	displayNewEventDialog(date, allDay);
        }
    });
};

/**
 * Returns date & time in ISO format, adjusting to current time zone if caller
 * wants that (Google timeMin/timeMax use current time zone instead of UTC)
 */
function getTimeIso(dt, useLocalTimezone) {
	// From: http://stackoverflow.com/questions/2573521/how-do-i-output-an-iso-8601-formatted-string-in-javascript
	if (!Date.prototype.toISOString) {
		Date.prototype.toISOString = function() {
			function pad(n) { return n < 10 ? '0' + n : n }
			// NOTE: removed newline after "return" to fix parsing the return in IE8 (MacBook Pro VM)
			return this.getUTCFullYear() + '-'
					+ pad(this.getUTCMonth() + 1) + '-'
					+ pad(this.getUTCDate()) + 'T'
					+ pad(this.getUTCHours()) + ':'
					+ pad(this.getUTCMinutes()) + ':'
					+ pad(this.getUTCSeconds()) + 'Z';
		};
	}
	// Modify to current timezone. Note: this will not react to Sakai's user's timezone change.
	if (useLocalTimezone) {
		dt = new Date(dt.getTime() - (dt.getTimezoneOffset() * 60 * 1000));
	}
	var result = dt.toISOString();
	return result;
}

//prototype yyyymmdd format of the date
Date.prototype.yyyymmdd = function() {
    var yyyy = this.getFullYear().toString();
    var mm = (this.getMonth() + 1).toString();
    var dd = this.getDate().toString();
    return yyyy + "-" + (mm[1] ? mm : "0" + mm[0]) + "-" + (dd[1] ? dd : "0" + dd[0]);
};

//generate the RFC 3339 timestamp
Date.prototype.toRFC3339 = function() {
    function pad(n) {
        return (n < 10 ? '0' + n : n);
    };

    var offset = (this.getTimezoneOffset() / 60) * (-1);

    if (offset > 0) {
        offset = offset < 10 ? '+0' + offset : '+' + offset;
    } else if (offset < 0) {
        offset = offset > -10 ? '-0' + Math.abs(offset) : offset;
    }

    offset = offset + ':00';
    return (this.getFullYear() + '-' + pad(this.getMonth() + 1) + '-' + pad(this.getDate()) + 'T' + pad(this.getHours()) + ':' + pad(this.getMinutes()) + ':' + pad(this.getSeconds()) + offset);
};

//add hours to Date object
Date.prototype.addHours = function(h) {
    this.setHours(this.getHours() + h);
    return this;
};

//function to get event text (6:30pm) from event value (18:30)
getEventTimeText = function(eventTimeValue) {
	// arrays are now global                      
    var i = eventTimeValueArray.indexOf(eventTimeValue);
    
    var eventTimeText = eventTimeTextArray[i];
    
    return eventTimeText;                                     
};

//function to get event value (18:30) from event value (6:30pm)
getEventTimeValue = function(eventTimeText) {
	try{
		var hours = Number(eventTimeText.match(/^(\d+)/)[1]);
		var minutes = Number(eventTimeText.match(/:(\d+)/)[1]);
		var AMPM = eventTimeText.match(/(..)$/)[1];
	}
	catch(err) { // Handle regex errors if bad values entered by the user
		return -1;
	}
	// Perform some basic range validation
	if (hours < 1 || hours > 12){
		return -1;
	}
	else if (minutes < 0 || minutes > 59){
		return -1;
	}
	else if (AMPM != "am" && AMPM != "pm"){
		return -1;
	}
	// Format time to a 24-hour format.
	if(AMPM == "pm" && hours<12) hours = hours+12;
	if(AMPM == "am" && hours==12) hours = hours-12;
	var sHours = hours.toString();
	var sMinutes = minutes.toString();
	if(hours<10) sHours = "0" + sHours;
	if(minutes<10) sMinutes = "0" + sMinutes;
	eventTimeValue = sHours + ":" + sMinutes;
    
    return eventTimeValue;                                     
};

// function to find the event in the full calendar event array and update the sequence
findFullCalendarEvent = function( event ) {
	for ( var i = 0; i < eventArray.length; i++ ) {
		if ( event.id === eventArray[i].id) {
			// update the sequence
			eventArray[i].sequence++;
			return i;
		}
	}
	return -1; // did not find it
};

// Check if user has closed the Google calendar pop-up window and refresh display
function checkIfPopUpIsClosed() {
	if (gCalPopUpHandle !== null && createEventsAllowed == "true" && gCalPopUpHandle.closed) {
		clearInterval(intervalHandle); // Clear timer service.
		$('#calendar').fullCalendar( 'refetchEvents' ); // Refetch events to show any updates.
	}
}

// refresh calendar items
refreshCalendarItems = function( start, end, callback ) {
	// use Math function to make sure this request is unique (caching issues can happen in ie - may be refactored out later)
	jQuery.ajax({
    	type : "GET",
    	url : baseUrl + '/' + proxyName + '/calendar/v3/calendars/' + gcalid + '/events?access_token=' + accesstoken +'&amp;' + Math.floor((Math.random()*100)+1),
        dataType : 'json',
        
        data : {
            'timeMin' : getTimeIso(start, false),
            'timeMax' : getTimeIso(end, false),
            'singleEvents' : true,
            'showDeleted'  : false,
            'timeZone'	   : userTimeZone,
        },
        cache : false,
        async : false,
        
        // if ajax call success
        success : function(data) {
  
        	eventArray.length = 0; // Clear out the array
            var itemsize = data.items.length; 

            // Sort array events by start date so user can tab through events in chronolgical order.	
            data.items.sort(sort_calendar_events_by_start_date);
            
            if ( itemsize > 0 ) {
		        jQuery.each(data.items, function(i, item) {
		            var startdate;
		            var enddate;
		            var allday; 
		            
		            if (item.start.dateTime) {
		                startdate = item.start.dateTime;
		                enddate = item.end.dateTime;
		                allday = false;
		            } else {
		                startdate = item.start.date;
		                // enddate = new Date(item.end.date); // IE does not like the enddate being set
		                allday = true;
		            }
		            
		            // TODO: not the long-term solution
		            if ( viewbusyOnly ) {
		            	titleString = busy;
		            	descriptionString = busy;
		            	locationString = busy;
		            } else {
		            	titleString = item.summary;
		            	descriptionString = item.description;
		            	locationString = item.location
		            }
		             
                    eventArray.push({
                        id : item.id,
                        title : titleString,
                        start : startdate,
                        end : enddate,
                        url : item.htmlLink,
                        description : descriptionString,
                        location : locationString,
                        allDay : allday,
                        sequence : item.sequence,
                        recurrence : item.recurrence,
                        recurringEventId : item.recurringEventId
                    });

		        });
            } // close if
        },
        // if ajax call failed 
        error : function(XMLHttpRequest, textStatus, errorThrown) {
            $("#newEvent .messageValidation").remove();
            displayNewEventDialogErrorMessage(lang.langdata.problemAccessingGoogle);
        	//if (null !== console ) { console.log( "AJAX call failed getting info from Google calendar " + textStatus + " " + errorThrown ); } 
        },
        
        complete : function () {
        	decorateControlsForAccessibility(); // Update dom elements so we can access them with keyboard.
        	callback(eventArray); // return callback here to pick up all events
        }
    });
};

// from http://stackoverflow.com/questions/3629183/why-doesnt-indexof-work-on-an-array-ie8
// ie8 does not support indexOf!
if (!Array.prototype.indexOf)
{
  Array.prototype.indexOf = function(elt /*, from*/)
  {
    var len = this.length >>> 0;

    var from = Number(arguments[1]) || 0;
    from = (from < 0)
         ? Math.ceil(from)
         : Math.floor(from);
    if (from < 0)
      from += len;

    for (; from < len; from++)
    {
      if (from in this &&
          this[from] === elt)
        return from;
    }
    return -1;
  };
}