package org.sakaiproject.gcalendar.impl;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Date;
import java.util.List;
import java.util.Stack;

import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.sakaiproject.assignment.api.AssignmentConstants;
import org.sakaiproject.authz.api.SecurityService;
import org.sakaiproject.calendar.api.Calendar;
import org.sakaiproject.calendar.api.CalendarEvent;
import org.sakaiproject.calendar.api.CalendarEvent.EventAccess;
import org.sakaiproject.calendar.api.CalendarEventEdit;
import org.sakaiproject.component.api.ServerConfigurationService;
import org.sakaiproject.component.cover.ComponentManager;
import org.sakaiproject.entity.api.ResourceProperties;
import org.sakaiproject.exception.IdUnusedException;
import org.sakaiproject.exception.IdUsedException;
import org.sakaiproject.exception.InUseException;
import org.sakaiproject.exception.PermissionException;
import org.sakaiproject.gcalendar.api.SakaiGCalendarServiceStaticVariables;
import org.sakaiproject.javax.Filter;
import org.sakaiproject.site.api.Site;
import org.sakaiproject.site.api.SiteService;
import org.sakaiproject.site.api.ToolConfiguration;
import org.sakaiproject.time.api.Time;
import org.sakaiproject.time.api.TimeRange;
import org.sakaiproject.time.cover.TimeService;
import org.sakaiproject.tool.cover.ToolManager;
import org.sakaiproject.user.api.User;
import org.sakaiproject.user.cover.UserDirectoryService;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import com.google.api.client.util.DateTime;
import com.google.api.services.calendar.model.Event;
import com.google.api.services.calendar.model.EventDateTime;
import com.google.api.services.calendar.model.Events;

public class SakaiGCalendarImpl implements Calendar {
	
	/** Our logger. */
	private static Log M_log = LogFactory.getLog(SakaiGCalendarImpl.class);
	
	/** Dependency: ServerConfigurationService */
	protected ServerConfigurationService m_serverConfigurationService = (ServerConfigurationService)ComponentManager.get(ServerConfigurationService.class.getName());

	/** Dependency: SiteService. */
	protected SiteService m_siteService = (SiteService)ComponentManager.get(SiteService.class.getName());

	/** Dependency: SecurityService. */
	protected SecurityService securityService = (SecurityService)ComponentManager.get(SecurityService.class.getName());;
	
	/** Client used to invoke the Google API's */
	private com.google.api.services.calendar.Calendar client;
	
	public SakaiGCalendarImpl(com.google.api.services.calendar.Calendar client){
		this.client = client;
	};
	
	@Override
	public String getContext() {
		// This method is not supported.
		return null;
	}
	@Override
	public boolean getExportEnabled() {
		// This method is not supported.
		return false;
	}
	@Override
	public void setExportEnabled(boolean enable) {
		// This method is not supported.
		
	}
	@Override
	public Time getModified() {
		// This method is not supported.
		return null;
	}
	@Override
	public void setModified() {
		// This method is not supported.
		
	}
	@Override
	public boolean allowGetEvents() {
		String currentUserId = getCurrentUserId();
		
		String siteId = ToolManager.getCurrentPlacement().getContext();
		String siteServiceString = org.sakaiproject.site.cover.SiteService.siteReference(siteId);
		if ( securityService.unlock(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_VIEW, siteServiceString)){
			return true;
		}
		else{
			return false;
		}
	}
	
	@Override
	public boolean allowGetEvent(String eventId) {
		String currentUserId = getCurrentUserId();
		
		String siteId = ToolManager.getCurrentPlacement().getContext();
		String siteServiceString = org.sakaiproject.site.cover.SiteService.siteReference(siteId);
		if ( securityService.unlock(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_VIEW, siteServiceString)){
			return true;
		}
		else{
			return false;
		}
	}
	/**
	 * Retrieves a list of events from a calendar based on a date range.
	 * The filter parameter is not used.
	 */
	@Override
	public List<CalendarEvent> getEvents(TimeRange range, Filter filter)
			throws PermissionException {
		
		Site site = getSite();
		// Retrieve gcalendar id from site properties
		String gcalid = site.getProperties().getProperty(SakaiGCalendarServiceStaticVariables.GCALID);	
		if (gcalid == null){
			M_log.error("Calendar Id not found on site properties. Cannot retrieve events!!!");
			return new ArrayList<CalendarEvent>();
		}
		
		Events calendarEvents = null;
		
		// Map the Calendar range date values to values that can be used in the
		// Google API call.
		Time startTime = range.firstTime();
		Time endTime = range.lastTime();
		
		Date startDate = new Date(startTime.getTime());
		Date endDate = new Date(endTime.getTime());
		
		DateTime start = new DateTime(startDate);
		DateTime end = new DateTime(endDate);
		
		// Call Google API
		try {
			calendarEvents = client.events().list(gcalid).setTimeMin(start).setTimeMax(end).execute();
			M_log.debug("Found " + calendarEvents.getItems().size() + " events for Google Calendar");
		} catch (IOException e) {
			M_log.error("Failed to query Google calendar for events." + e.getMessage());
		}

		// Add Google calendar events to list
		List<CalendarEvent> calendarEventList = new ArrayList<CalendarEvent>();
		
		for (Event evt : calendarEvents.getItems()){
			calendarEventList.add(createEventFromGoogleCalendarEvent(evt));			
		}
		
		return calendarEventList;
	}
	/**
	 * Retrieve a specific event from the Google Calendar.
	 */
	@Override
	public CalendarEvent getEvent(String eventId) throws IdUnusedException,
			PermissionException {
		// Retrieve Google event from Google calendar
		Event gEvent = getGoogleCalendarEvent(eventId);
		// Convert the Google event to a calendar event
		CalendarEvent calEvent = (CalendarEvent)createEventFromGoogleCalendarEvent(gEvent);
		return calEvent;
	}
	
	@Override
	public String getEventFields() {
		M_log.warn("This method is not implemented");
		return null;
	}
	
	/**
	 * Checks if current user has permission to add an event to the Google calendar.
	 */
	@Override
	public boolean allowAddEvent() {
		String currentUserId = getCurrentUserId();
		
		String siteId = ToolManager.getCurrentPlacement().getContext();
		String siteServiceString = org.sakaiproject.site.cover.SiteService.siteReference(siteId);
		if ( securityService.unlock(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, siteServiceString)){
			return true;
		}
		else{
			return false;
		}
	}
	
	@Override
	public boolean allowAddCalendarEvent() {
		String currentUserId = getCurrentUserId();
		
		String siteId = ToolManager.getCurrentPlacement().getContext();
		String siteServiceString = org.sakaiproject.site.cover.SiteService.siteReference(siteId);
		if ( securityService.unlock(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, siteServiceString)){
			return true;
		}
		else{
			return false;
		}
	}
	/**
	 * Adds an event to the Google Calendar.
	 */
	@Override
	public CalendarEvent addEvent(TimeRange range, String displayName,
			String description, String type, String location,
			EventAccess access, Collection groups, List attachments)
			throws PermissionException {
		CalendarEvent calEvent = null;
		// Verify user has permission to add an event.
		if (allowAddEvent()){
			Site site = getSite();
			// Retrieve Google calendar id from site properties
			String gcalid = site.getProperties().getProperty(SakaiGCalendarServiceStaticVariables.GCALID);	
			if (gcalid == null){
				M_log.error("Calendar Id not found on site properties. Cannot add event!!!");
				return null;
			}
			
			// Create a Google event object with the event details
			Event event = createGoogleCalendarEvent(range, displayName, description, type, location, access, groups, attachments);
			
			// Call Google API to add the event to the calendar
			Event createdEvent = null;
			try {
				createdEvent = client.events().insert(gcalid, event).execute();
				
				M_log.debug("Google Calendar Event Created:  " + createdEvent.getId());
			} catch (IOException e) {
				M_log.error("Error adding event to Google Calendar " + e.getMessage());
			}
			// Map the values from the Google Calendar event to a Calendar Event
			calEvent = createEventFromGoogleCalendarEvent(createdEvent);
			return calEvent;
		}
		else{
			String currentUserId = getCurrentUserId();
			// There is no reference id to pass to the PermissionException constructor so we pass in a "".
			throw new PermissionException(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, "");
		}
	}
	
	/**
	 * Adds an event to the Google Calendar.
	 */
	@Override
	public CalendarEvent addEvent(TimeRange range, String displayName,
			String description, String type, String location, List attachments)
			throws PermissionException {
		CalendarEvent calEvent = addEvent(range,displayName,description,type,location,attachments);
		return calEvent;
	}

	/**
	 * This method is not supported in Google Calendar.
	 */
	@Override
	public CalendarEventEdit addEvent() throws PermissionException {
		M_log.warn("This method is not supported in Google Calendar.");
		throw new PermissionException(getCurrentUserId(), SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, "");
	}

	/**
	 * Checks if current user has permission to modify an event on the Google calendar.
	 */
	@Override
	public boolean allowEditEvent(String eventId) {
		String currentUserId = getCurrentUserId();
		
		String siteId = ToolManager.getCurrentPlacement().getContext();
		String siteServiceString = org.sakaiproject.site.cover.SiteService.siteReference(siteId);
		if ( securityService.unlock(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, siteServiceString)){
			return true;
		}
		else{
			return false;
		}
	}
	
	// Retrieves event for editing. 
	// I don't think the parameter editType is applicable to this implementation.
	@Override
	public CalendarEventEdit getEditEvent(String eventId, String editType)
			throws IdUnusedException, PermissionException, InUseException {

		// Retrieve Google event from Google calendar
		Event gEvent = getGoogleCalendarEvent(eventId);
		// Convert the Google event to an editable calendar event
		CalendarEventEdit calEvent = createEventFromGoogleCalendarEvent(gEvent);
		return calEvent;
	}
	
	@Override
	public void commitEvent(CalendarEventEdit edit, int intention) {
		// There is nothing to be done here.
	}
	
	@Override
	public void commitEvent(CalendarEventEdit edit) {
		// There is nothing to be done here.		
	}
	
	@Override
	public void cancelEvent(CalendarEventEdit edit) {
		// There is nothing to be done here.
	}
	/**
	 * This method is not supported.
	 */
	@Override
	public CalendarEventEdit mergeEvent(Element el) throws PermissionException,
			IdUsedException {
		M_log.info("This functionality is not supported.");
		return null;
	}
	
	/**
	 * Checks permission to remove an event from the Google calendar.
	 */
	@Override
	public boolean allowRemoveEvent(CalendarEvent event) {
		
		return allowEditEvent(event.getId());
	}
	
	//TODO: Implement logic to handle intention.
	@Override
	public void removeEvent(CalendarEventEdit edit, int intention)
			throws PermissionException {
		// Check user has permission to remove event from the Google calendar
		if(allowRemoveEvent(edit)){
			removeEvent(edit);
		}
		else{
			String currentUserId = getCurrentUserId();
			// Using the GCal event id as the last parameter of the PermissionException constructor.
			throw new PermissionException(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, edit.getId());
		}
	}

	/**
	 * Removes an event from the Google calendar.
	 */
	@Override
	public void removeEvent(CalendarEventEdit edit) throws PermissionException {
		// Check user has permission to remove event from the Google calendar
		if (allowRemoveEvent(edit)){
			Site site = getSite();
			// Retrieve Google calendar id from site properties
			String gcalid = site.getProperties().getProperty(SakaiGCalendarServiceStaticVariables.GCALID);	
			if (gcalid == null){
				M_log.error("Calendar Id not found on site properties. Cannot delete event!!!");
				return;
			}
			
			// Call Google API
			try {
				M_log.debug("Going to delete Google calendar event with id: " + edit.getId());
				client.events().delete(gcalid, edit.getId()).execute();
				M_log.debug("Google Calendar Event Successfully Deleted..." + edit.getId());
			} catch (IOException e) {
				if (e.getMessage().indexOf("410") != -1){
					M_log.warn("Google calendar event was previously deleted.");
				}
				else{
					M_log.error("Error deleting event from Google Calendar. " + e.getMessage());
				}
			}
		}
		else{
			String currentUserId = getCurrentUserId();
			// Using the GCal event id as the last parameter of the PermissionException constructor.
			throw new PermissionException(currentUserId, SakaiGCalendarServiceStaticVariables.SECURE_GCAL_EDIT, edit.getId());
		}
	}
	
	@Override
	public Collection getGroupsAllowAddEvent() {
		// Groups are not supported
		return null;
	}
	@Override
	public Collection getGroupsAllowGetEvent() {
		// Groups are not supported
		return null;
	}
	@Override
	public Collection getGroupsAllowRemoveEvent(boolean own) {
		// Groups are not supported
		return null;
	}
	
	/**
	 * Maps some of the Google event fields to a Calendar Event.
	 * @param event
	 * @return
	 */
	private CalendarEventEdit createEventFromGoogleCalendarEvent(Event event){
		SakaiGCalendarEventImpl calEvent = new SakaiGCalendarEventImpl();
		calEvent.setId(event.getId());
		calEvent.setDescription(event.getDescription());
		calEvent.setDisplayName(event.getSummary());
		calEvent.setLocation(event.getLocation());
		// Handle event start and end times.
		try{
			calEvent.setRange(TimeService.newTimeRange(TimeService.newTime(event.getStart().getDateTime().getValue()), TimeService.newTime(event.getEnd().getDateTime().getValue())));
		}
		catch (NullPointerException ex){
			M_log.error("Unexpected error with Google Calendar event. " + ex.getMessage());
		}
		
		return calEvent;
	}
	
	/**
	 * Retrieves an event from the Google calendar by calling the Google API
	 * Note: Deleted events remain in the calendar and are found by this call
	 * @param eventId
	 * @return a Google calendar event
	 * @throws IdUnusedException 
	 */
	private Event getGoogleCalendarEvent(String eventId) throws IdUnusedException{
		if (eventId == null){ // Should have an id before calling the API.
			M_log.error("Failed to get Google calendar event. EventId cannot be null!!!");
			return null;
		}
		Site site = getSite();
		// Retrieve Google calendar id from site properties
		String gcalid = site.getProperties().getProperty(SakaiGCalendarServiceStaticVariables.GCALID);	
		if (gcalid == null){
			M_log.error("Calendar Id not found on site properties. Cannot add event!!!");
			return null;
		}

		Event event = null;
		// Call Google API
		try {
			event = client.events().get(gcalid, eventId).execute();
		} catch (IOException e) {
			M_log.error("Error retrieving event from Google Calendar. " + e.getMessage());
			if (e.getMessage().indexOf("404") != -1){
				throw new IdUnusedException(eventId);
			}
		}
		return event;
	}
	// Retrieve site information
	private Site getSite(){
		String siteId = ToolManager.getCurrentPlacement().getContext();
		Site site = null;
		try {
			site = this.m_siteService.getSite(siteId);
		} catch (IdUnusedException e) {
			M_log.error("Error retrieving site information: " + e.getMessage());
		}
		return site;
	}
	
    /**
     * Retrieves current user id.
     * @return
     */
	private String getCurrentUserId() {
		User currentUser = UserDirectoryService.getCurrentUser();
    	String currentUserId = currentUser.getId();
		return currentUserId;
	}
	
	// Creates a Google calendar event with the values provided.
	// The return Event is used to call the Google API
	// The type parameter is ignored and access, groups and attachments are not supported.
	private Event createGoogleCalendarEvent(TimeRange range, String displayName,
									String description, String type, String location,
									EventAccess access, Collection groups, List attachments) {
		// Log warnings if unsupported parameters are provided.
		if (access != null){
			M_log.warn("access parameter is not supported");
		}
		if (groups != null){
			M_log.warn("groups parameter is not supported");
		}
		if (attachments != null){
			M_log.warn("attachments parameter is not supported");
		}
		Event event = new Event();

		event.setSummary(displayName);
		event.setDescription(description);
		event.setLocation(location);
		
		// Handle event time details
		Time startTime = range.firstTime();
		Date startDate = new Date(startTime.getTime());
		Time endTime = range.lastTime();
		Date endDate = new Date(endTime.getTime());
		DateTime start = new DateTime(startDate);
		event.setStart(new EventDateTime().setDateTime(start));
		DateTime end = new DateTime(endDate);
		event.setEnd(new EventDateTime().setDateTime(end));
		
		return event;
	}
	@Override
	public String getUrl() {
		// This method is not supported.
		return null;
	}
	@Override
	public String getReference() {
		// This method is not supported.
		return null;
	}
	@Override
	public String getUrl(String rootProperty) {
		// This method is not supported.
		return null;
	}
	@Override
	public String getReference(String rootProperty) {
		// This method is not supported.
		return null;
	}
	@Override
	public String getId() {
		Site site = getSite();
		// Retrieve Google calendar id from site properties
		String gcalid = site.getProperties().getProperty(SakaiGCalendarServiceStaticVariables.GCALID);	
		return gcalid;
	}
	@Override
	public ResourceProperties getProperties() {
		// This method is not supported.
		return null;
	}
	@Override
	public Element toXml(Document doc, Stack<Element> stack) {
		// This method is not supported.
		return null;
	}

}
