// Define your Knack credentials as constants
const knackAppId = "5ee90912c38ae7001510c1a9";
const knackApiKey = "8f733aa5-dd35-4464-8348-64824d1f5f0d";

// Define a constant for the Knack API endpoint
const KNACK_API_URL = 'https://api.knack.com/v1';

// Use a more unique name for the configuration
const EMBEDDED_APP_CONFIG = {
  'scene_1204': { // Your scene ID
    'view_3002': { // Your view ID
      appType: 'study-planner',
      elementSelector: '.kn-rich-text', // General selector for rich text fields
      appUrl: 'https://study-planner-knack-1a17daf86537.herokuapp.com/' // Your Heroku app URL
    }
  }
};

// Define which object and fields you're using
const EMBEDDED_USER_DATA_OBJECT = 'object_105'; // Your user data object
const EMBEDDED_USER_ID_FIELD = 'field_3004';    // Field that connects to user
const EMBEDDED_DATA_FIELD = 'field_3002';       // Field that stores JSON data

// Initialize when the specific scene renders
$(document).on('knack-scene-render.scene_1204', function(event, scene) {
  console.log("Embedded app: Scene rendered:", scene.key);
  initializeEmbeddedApp();
});

// Function to clean HTML from IDs
function cleanHtmlFromId(idString) {
  if (!idString) return null;
  
  // If it's already an object with an id
  if (typeof idString === 'object' && idString.id) {
    // Clean the id inside the object
    return { id: cleanHtmlFromId(idString.id) };
  }
  
  // Convert to string if it's not already
  const str = idString.toString();
  
  // Check if it contains HTML
  if (str.includes('<')) {
    console.log("Embedded app: Cleaning HTML from ID:", str);
    
    // If it's wrapped in a span with a class that looks like an ID
    const spanMatch = str.match(/<span class="([^"]+)">([^<]+)<\/span>/);
    if (spanMatch) {
      console.log("Embedded app: Extracted ID from span class:", spanMatch[1]);
      return spanMatch[1]; // Use the class as the ID, which is often the real ID
    }
    
    // Otherwise just strip all HTML
    const cleanStr = str.replace(/<[^>]+>/g, '').trim();
    console.log("Embedded app: Stripped HTML from ID:", cleanStr);
    return cleanStr;
  }
  
  return str;
}

function getCompleteUserData(userId, callback) {
  console.log("Embedded app: Getting complete user data for:", userId);
  
  $.ajax({
    url: KNACK_API_URL + '/objects/object_3/records/' + userId,
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    success: function(response) {
      console.log("Embedded app: Complete user data:", response);
      console.log("Embedded app: field_73 value:", response.field_73);
      console.log("Embedded app: All role-related fields:", {
        field_73: response.field_73,
        profile_keys: Object.keys(response).filter(key => key.includes('role') || key.includes('type'))
      });
      
      // Store this data for later use
      window.completeUserData = response;
      
      callback(response);
    },
    error: function(error) {
      console.error("Embedded app: Error retrieving complete user data:", error);
      callback(null);
    }
  });
}

// Function to retrieve the tutor connected to a student
function getTutorForStudent(studentEmail, callback) {
  console.log("Embedded app: Looking for tutor for student email:", studentEmail);
  $.ajax({
    url: KNACK_API_URL + '/objects/object_6/records',
    type: 'GET',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: {
      format: 'raw',
      filters: JSON.stringify({
        match: 'and',
        rules: [
          {
            field: 'field_91', // Student email field in Object_6
            operator: 'is',
            value: studentEmail
          }
        ]
      })
    },
    success: function(response) {
      console.log("Embedded app: getTutorForStudent response:", response);
      if (response.records && response.records.length > 0) {
        console.log("Embedded app: Full student record:", response.records[0]);
        console.log("Embedded app: field_1682 value:", response.records[0].field_1682);
        
        let tutorInfo = null;
        // Retrieve the tutor connection from field_1682
        if (response.records[0].field_1682) {
          if (Array.isArray(response.records[0].field_1682) && response.records[0].field_1682.length > 0) {
            console.log("Embedded app: Tutor is in array format");
            tutorInfo = response.records[0].field_1682[0];
          } else if (typeof response.records[0].field_1682 === 'object') {
            console.log("Embedded app: Tutor is in object format");
            tutorInfo = response.records[0].field_1682;
          } else {
            console.log("Embedded app: Tutor is in simple value format");
            tutorInfo = { id: response.records[0].field_1682 };
          }
        }
        
        // Also store the VESPA customer relationship from field_279
        if (response.records[0].field_279) {
          console.log("Embedded app: Found VESPA Customer in student record:", response.records[0].field_279);
          window.studentVESPACustomer = response.records[0].field_279;
        }
        
        console.log("Embedded app: Extracted tutor info:", tutorInfo);
        callback(tutorInfo);
      } else {
        console.log("Embedded app: No student record found with email:", studentEmail);
        callback(null);
      }
    },
    error: function(error) {
      console.error("Embedded app: Error retrieving tutor info:", error);
      callback(null);
    }
  });
}

// Function to get student data
function getStudentData(studentEmail, callback) {
  console.log("Embedded app: Looking for student data with email:", studentEmail);
  getTutorForStudent(studentEmail, function(tutorInfo) {
    // Store tutor info for later
    window.studentTutorInfo = tutorInfo;
    
    // Call back with the full student info including tutor
    callback({
      tutor: tutorInfo,
      vespaCustomer: window.studentVESPACustomer
    });
  });
}

// Modified initializeEmbeddedApp function to include complete user data
function initializeEmbeddedApp() {
  console.log("Initializing embedded React app");
  
  // Get config for this scene/view
  const config = EMBEDDED_APP_CONFIG['scene_1204']['view_3002'];
  
  // Check if user is authenticated
  if (typeof Knack !== 'undefined' && Knack.getUserToken()) {
    console.log("Embedded app: User is authenticated");
    
    // Get user data
    const userToken = Knack.getUserToken();
    const appId = Knack.application_id;
    const user = Knack.getUserAttributes();
    
    console.log("Embedded app: Basic user info:", user);
    
    // Store the current user globally for later use
    window.currentKnackUser = user;
    
    // Get complete user data including role information
    getCompleteUserData(user.id, function(completeUserData) {
      if (completeUserData) {
        // Enhance the stored user info
        window.currentKnackUser = Object.assign({}, user, completeUserData);
        
        // Check if user is a student
        console.log("Embedded app: Checking if user is a student...");
        const isStudent = 
          (completeUserData.field_73 && completeUserData.field_73.toString().toLowerCase().includes('student')) ||
          Object.values(completeUserData).some(v => 
            typeof v === 'string' && 
            v.toLowerCase() === 'student'
          );
        
        if (isStudent) {
          console.log("Embedded app: User appears to be a student, getting student-specific data");
          getStudentData(user.email, function(studentData) {
            console.log("Embedded app: Got student data:", studentData);
            window.currentKnackUser.role = 'Student';
            window.currentKnackUser.studentData = studentData;
            continueInitialization();
          });
        } else {
          console.log("Embedded app: User does not appear to be a student");
          continueInitialization();
        }
      } else {
        console.log("Embedded app: Could not get complete user data, continuing with basic info");
        continueInitialization();
      }
    });
    
    function continueInitialization() {
      // Use a more flexible approach to find a container
      let container = document.querySelector(config.elementSelector);
    
      // If that doesn't work, try to find any rich text field
      if (!container) {
        console.log("Embedded app: First selector failed, trying alternatives");
        container = document.querySelector('.kn-rich-text');
      }
      
      // If that still doesn't work, find the view and create a container
      if (!container) {
        console.log("Embedded app: No rich text field found, looking for the view");
        const view = document.getElementById('view_3002') || document.querySelector('.view_3002');
        
        if (view) {
          console.log("Embedded app: View found, creating container");
          container = document.createElement('div');
          container.id = 'react-app-container';
          container.style.margin = '20px 0';
          view.appendChild(container);
        }
      }
      
      // Final fallback - just add to the scene
      if (!container) {
        console.log("Embedded app: No suitable container found, adding to scene");
        const scene = document.getElementById('kn-scene_1204');
        if (scene) {
          container = document.createElement('div');
          container.id = 'react-app-container';
          container.style.margin = '20px 0';
          scene.appendChild(container);
        } else {
          console.error("Embedded app: Cannot find any suitable container for the app");
          return;
        }
      }
      
      // Clear any existing content
      container.innerHTML = '';
      
      // Create a loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'app-loading';
      loadingDiv.innerHTML = '<p>Loading your app...</p>';
      loadingDiv.style.padding = '20px';
      loadingDiv.style.textAlign = 'center';
      container.appendChild(loadingDiv);
      
      // Create an iframe for the React app
      const iframe = document.createElement('iframe');
      iframe.id = 'react-app-iframe';
      iframe.style.width = '100%';
      iframe.style.height = '600px'; // Adjust as needed
      iframe.style.border = 'none';
      iframe.style.display = 'none'; // Hide initially until loaded
      iframe.src = config.appUrl;
      container.appendChild(iframe);
      
      // Track authentication status
      let authSent = false;
      
      // Set up message listener for communication with the iframe
      window.addEventListener('message', function(event) {
        // Only accept messages from our iframe
        if (event.source !== iframe.contentWindow) {
          return;
        }
        
        console.log("Embedded app: Message from React app:", event.data);
        
        if (event.data && event.data.type) {
          switch(event.data.type) {
            case 'APP_READY':
              console.log("Embedded app: React app is ready, sending user info");
              
              // First, get user data
              loadEmbeddedUserData(user.id, function(userData) {
                // Send authentication and user data to the iframe
                iframe.contentWindow.postMessage({
                  type: 'KNACK_USER_INFO',
                  data: {
                    id: user.id,
                    email: user.email,
                    token: userToken,
                    appId: appId,
                    userData: userData || {}
                  }
                }, '*');
                
                authSent = true;
                console.log("Embedded app: Sent user info to React app");
              });
              break;
              
            case 'AUTH_CONFIRMED':
              console.log("Embedded app: Authentication confirmed by React app");
              
              // Hide loading indicator and show iframe
              loadingDiv.style.display = 'none';
              iframe.style.display = 'block';
              break;
              
            case 'SAVE_DATA':
              console.log("Embedded app: Saving data from React app:", event.data.data);
              
              // Save the data to Knack
              saveEmbeddedUserData(user.id, event.data.data, function(success) {
                // Notify the React app about the save result
                iframe.contentWindow.postMessage({
                  type: 'SAVE_RESULT',
                  success: success
                }, '*');
              });
              break;
          }
        }
      });
      
      // Set a timeout to check if auth was sent
      setTimeout(function() {
        if (!authSent) {
          console.log("Embedded app: Auth timeout - trying to send again");
          
          // Try to send auth info again
          loadEmbeddedUserData(user.id, function(userData) {
            iframe.contentWindow.postMessage({
              type: 'KNACK_USER_INFO',
              data: {
                id: user.id,
                email: user.email,
                token: userToken,
                appId: appId,
                userData: userData || {}
              }
            }, '*');
          });
        }
      }, 5000);
    }
  } else {
    console.error("Embedded app: User is not authenticated");
    // Redirect to login page if needed
    // window.location.href = "/login";
  }
}

// Function to load user data from Knack
function loadEmbeddedUserData(userId, callback) {
  console.log("Embedded app: Loading user data for:", userId);
  
  // First try to load from localStorage as a cache
  const localData = localStorage.getItem('embeddedAppData_' + userId);
  
  if (localData) {
    try {
      const userData = JSON.parse(localData);
      console.log("Embedded app: Found data in localStorage cache:", userData);
      
      // Return the cached data immediately
      callback(userData);
      
      // Then try to get fresh data from Knack in the background
      refreshDataFromKnack(userId, userData);
      
      return;
    } catch (e) {
      console.error("Embedded app: Error parsing localStorage data:", e);
    }
  }
  
  // No cached data, try to get it directly from Knack via a hidden view
  refreshDataFromKnack(userId, {});
  
  // Return empty object for now
  console.log("Embedded app: No cached data, returning empty object while loading from Knack");
  callback({});
}

// Helper function to refresh data from Knack
function refreshDataFromKnack(userId, fallbackData) {
  // Create a temporary hidden form to submit
  const form = document.createElement('form');
  form.style.display = 'none';
  form.action = '#'; // Will be intercepted
  form.id = 'temp-data-form';
  
  const idField = document.createElement('input');
  idField.type = 'hidden';
  idField.name = 'id';
  idField.value = userId;
  
  form.appendChild(idField);
  document.body.appendChild(form);
  
  // Use Knack's form submission which handles CORS properly
  $(form).submit(function(e) {
    e.preventDefault();
    
    // Create a finder that looks for records matching the user ID
    const filters = {
      match: 'and',
      rules: [
        {
          field: EMBEDDED_USER_ID_FIELD,
          operator: 'is',
          value: userId
        }
      ]
    };
    
    // Use Knack's internal API object which is already authenticated
    try {
      Knack.showSpinner();
      $.ajax({
        url: KNACK_API_URL + '/objects/' + EMBEDDED_USER_DATA_OBJECT + '/records',
        type: 'GET',
        headers: {
          'X-Knack-Application-Id': knackAppId,
          'X-Knack-REST-API-Key': knackApiKey,
          'Authorization': Knack.getUserToken(),
          'Content-Type': 'application/json'
        },
        data: {
          format: 'raw',
          filters: JSON.stringify(filters)
        },
        success: function(response) {
          Knack.hideSpinner();
          
          if (response.records && response.records.length > 0) {
            console.log("Embedded app: Found user data record in Knack:", response.records[0]);
            
            // Get the JSON data field
            let userData = {};
            try {
              if (response.records[0][EMBEDDED_DATA_FIELD]) {
                userData = JSON.parse(response.records[0][EMBEDDED_DATA_FIELD]);
              }
            } catch (e) {
              console.error("Embedded app: Error parsing Knack data:", e);
              userData = fallbackData;
            }
            
            // Store the record ID for future updates
            localStorage.setItem('embeddedAppRecordId_' + userId, response.records[0].id);
            
            // Cache the data
            localStorage.setItem('embeddedAppData_' + userId, JSON.stringify(userData));
            
            // Send the data to the iframe if it differs from what we already sent
            if (JSON.stringify(userData) !== JSON.stringify(fallbackData)) {
              const iframe = document.getElementById('react-app-iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'LOAD_SAVED_DATA',
                  data: userData
                }, '*');
              }
            }
          } else {
            console.log("Embedded app: No data record found in Knack, will create one");
            createUserDataRecordViaForm(userId, fallbackData);
          }
        },
        error: function(error) {
          Knack.hideSpinner();
          console.error("Embedded app: Error loading data from Knack:", error);
        }
      });
    } catch (e) {
      Knack.hideSpinner();
      console.error("Embedded app: Exception in Knack data fetch:", e);
    }
  });
  
  // Trigger the submission
  $(form).trigger('submit');
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(form);
  }, 1000);
}

// Modified function to create a new record via form submission
function createUserDataRecordViaForm(userId, data) {
  console.log("Embedded app: Creating new user data record via form");
  
  // Convert the data to a JSON string
  const jsonData = JSON.stringify(data || {});
  
  // Prepare additional fields from the current user
  const additionalFields = {
    'field_3001': window.currentKnackUser.name || "",
    'field_3005': window.currentKnackUser.id || ""
  };
  
  // Add VESPA Customer if available
  if (window.currentKnackUser && window.currentKnackUser.field_122) {
    console.log("Embedded app: Found VESPA Customer in field_122:", window.currentKnackUser.field_122);
    // Clean and format the ID properly
    const cleanedId = cleanHtmlFromId(window.currentKnackUser.field_122);
    console.log("Embedded app: Cleaned VESPA Customer ID:", cleanedId);
    additionalFields['field_3003'] = { id: cleanedId };
  } else if (window.studentVESPACustomer) {
    console.log("Embedded app: Using VESPA Customer from student record:", window.studentVESPACustomer);
    const cleanedId = cleanHtmlFromId(window.studentVESPACustomer);
    console.log("Embedded app: Cleaned VESPA Customer ID from student record:", cleanedId);
    additionalFields['field_3003'] = { id: cleanedId };
  }
  
  // Add Tutor if available
  if (window.studentTutorInfo) {
    console.log("Embedded app: Adding tutor info to field_3006:", window.studentTutorInfo);
    // Clean and format the ID properly
    if (typeof window.studentTutorInfo === 'object' && window.studentTutorInfo.id) {
      const cleanedId = cleanHtmlFromId(window.studentTutorInfo.id);
      additionalFields['field_3006'] = { id: cleanedId };
    } else {
      const cleanedId = cleanHtmlFromId(window.studentTutorInfo);
      additionalFields['field_3006'] = { id: cleanedId };
    }
  }
  
  console.log("Embedded app: Final additionalFields for creation:", additionalFields);
  
  // Create the full payload
  const payload = Object.assign({
    [EMBEDDED_USER_ID_FIELD]: { id: userId },
    [EMBEDDED_DATA_FIELD]: jsonData
  }, additionalFields);
  
  // Use Knack's API to create the record
  try {
    Knack.showSpinner();
    
    $.ajax({
      url: KNACK_API_URL + '/objects/' + EMBEDDED_USER_DATA_OBJECT + '/records',
      type: 'POST',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(payload),
      success: function(response) {
        Knack.hideSpinner();
        console.log("Embedded app: Successfully created record in Knack:", response);
        
        // Store the record ID for future updates
        if (response && response.id) {
          localStorage.setItem('embeddedAppRecordId_' + userId, response.id);
        }
        
        // Cache the data
        localStorage.setItem('embeddedAppData_' + userId, jsonData);
      },
      error: function(error) {
        Knack.hideSpinner();
        console.error("Embedded app: Error creating record in Knack:", error);
        console.log("Embedded app: Error details:", JSON.stringify(error));
      }
    });
  } catch (e) {
    Knack.hideSpinner();
    console.error("Embedded app: Exception in Knack record creation:", e);
  }
}


// Function to create a new user data record
function createEmbeddedUserDataRecord(userId, data, callback) {
  // Define the payload for the new record
  const payload = {};
  
  // Set the user ID field to connect this record to the user
  payload[EMBEDDED_USER_ID_FIELD] = { id: userId };
  
  // Set the JSON data field with an empty object
  payload[EMBEDDED_DATA_FIELD] = JSON.stringify(data || {});
  
  // Create the record
  $.ajax({
    url: KNACK_API_URL + '/objects/' + EMBEDDED_USER_DATA_OBJECT + '/records',
    type: 'POST',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(payload),
    success: function(response) {
      console.log("Embedded app: Created new user data record:", response);
      callback(data);
    },
    error: function(error) {
      console.error("Embedded app: Error creating user data record:", error);
      callback({});
    }
  });
}

// Function to save user data to Knack
function saveEmbeddedUserData(userId, data, callback) {
  console.log("Embedded app: Saving user data:", data);
  
  // Always save to localStorage as a cache/backup
  try {
    localStorage.setItem('embeddedAppData_' + userId, JSON.stringify(data));
    console.log("Embedded app: Saved data to localStorage cache");
  } catch (e) {
    console.error("Embedded app: Error saving to localStorage:", e);
  }
  
  // Check if we have a record ID from previous operations
  const recordId = localStorage.getItem('embeddedAppRecordId_' + userId);
  
  if (recordId) {
    // Update the existing record
    updateUserDataRecordViaForm(recordId, data, callback);
  } else {
    // Try to find the record first
    $.ajax({
      url: KNACK_API_URL + '/objects/' + EMBEDDED_USER_DATA_OBJECT + '/records',
      type: 'GET',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      data: {
        format: 'raw',
        filters: JSON.stringify({
          match: 'and',
          rules: [
            {
              field: EMBEDDED_USER_ID_FIELD,
              operator: 'is',
              value: userId
            }
          ]
        })
      },
      success: function(response) {
        if (response.records && response.records.length > 0) {
          // Found existing record, update it
          const recordId = response.records[0].id;
          localStorage.setItem('embeddedAppRecordId_' + userId, recordId);
          updateUserDataRecordViaForm(recordId, data, callback);
        } else {
          // No record found, create a new one
          createUserDataRecordViaForm(userId, data);
          // Assume success for UI responsiveness
          callback(true);
        }
      },
      error: function(error) {
        console.error("Embedded app: Error finding record for update:", error);
        // Still return success for UI since we saved to localStorage
        callback(true);
      }
    });
  }
}

// Function to update an existing record
// Modified function to update an existing record
function updateUserDataRecordViaForm(recordId, data, callback) {
  console.log("Embedded app: Updating record", recordId, "with data:", data);
  
  // Convert the data to a JSON string
  const jsonData = JSON.stringify(data || {});
  
  // Prepare additional fields from the current user
  const additionalFields = {
    'field_3001': window.currentKnackUser.name || "",
    'field_3005': window.currentKnackUser.id || ""
  };
  
  // Add VESPA Customer if available
  if (window.currentKnackUser && window.currentKnackUser.field_122) {
    console.log("Embedded app: Found VESPA Customer in field_122:", window.currentKnackUser.field_122);
    // Clean and format the ID properly
    const cleanedId = cleanHtmlFromId(window.currentKnackUser.field_122);
    console.log("Embedded app: Cleaned VESPA Customer ID:", cleanedId);
    additionalFields['field_3003'] = { id: cleanedId };
  } else if (window.studentVESPACustomer) {
    console.log("Embedded app: Using VESPA Customer from student record:", window.studentVESPACustomer);
    const cleanedId = cleanHtmlFromId(window.studentVESPACustomer);
    console.log("Embedded app: Cleaned VESPA Customer ID from student record:", cleanedId);
    additionalFields['field_3003'] = { id: cleanedId };
  }
  
  // Add Tutor if available
  if (window.studentTutorInfo) {
    console.log("Embedded app: Adding tutor info to field_3006:", window.studentTutorInfo);
    // Clean and format the ID properly
    if (typeof window.studentTutorInfo === 'object' && window.studentTutorInfo.id) {
      const cleanedId = cleanHtmlFromId(window.studentTutorInfo.id);
      additionalFields['field_3006'] = { id: cleanedId };
    } else {
      const cleanedId = cleanHtmlFromId(window.studentTutorInfo);
      additionalFields['field_3006'] = { id: cleanedId };
    }
  }
  
  console.log("Embedded app: Final additionalFields for update:", additionalFields);
  
  // Create the full payload
  const payload = Object.assign({
    [EMBEDDED_DATA_FIELD]: jsonData
  }, additionalFields);
  
  // Use Knack's API to update the record
  try {
    $.ajax({
      url: KNACK_API_URL + '/objects/' + EMBEDDED_USER_DATA_OBJECT + '/records/' + recordId,
      type: 'PUT',
      headers: {
        'X-Knack-Application-Id': knackAppId,
        'X-Knack-REST-API-Key': knackApiKey,
        'Authorization': Knack.getUserToken(),
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(payload),
      success: function(response) {
        console.log("Embedded app: Successfully updated record in Knack:", response);
        callback(true);
      },
      error: function(error) {
        console.error("Embedded app: Error updating record in Knack:", error);
        console.log("Embedded app: Error details:", JSON.stringify(error));
        // Still return success since we saved to localStorage
        callback(true);
      }
    });
  } catch (e) {
    console.error("Embedded app: Exception in Knack record update:", e);
    // Still return success since we saved to localStorage
    callback(true);
  }
}
