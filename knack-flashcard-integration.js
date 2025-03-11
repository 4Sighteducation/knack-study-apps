// Flashcard App Integration with Knack
// This script connects the React Flashcard app with Knack and handles authentication and data transfer

// Define Knack credentials
const knackAppId = "5ee90912c38ae7001510c1a9";
const knackApiKey = "8f733aa5-dd35-4464-8348-64824d1f5f0d";

// Define Knack API endpoint
const KNACK_API_URL = 'https://api.knack.com/v1';

// Configuration for scenes and views where the app should be embedded
const FLASHCARD_APP_CONFIG = {
  'scene_1206': { // Your flashcard app scene ID
    'view_3005': { // Your rich text field view ID
      appType: 'flashcard-app',
      elementSelector: '.kn-rich-text', // Target element to mount the app
      appUrl: 'https://vespa-flashcards.herokuapp.com/' // Your Heroku app URL (update this)
    }
  }
};

// Object and field definitions
const FLASHCARD_OBJECT = 'object_102'; // Your flashcard object
const FIELD_MAPPING = {
  userId: 'field_2954',           // User ID
  userEmail: 'field_2958',        // User email
  accountConnection: 'field_2956', // Connection to account
  vespaCustomer: 'field_3008',    // VESPA Customer Connection
  tutorConnection: 'field_3009',  // Tutor Connection
  cardBankData: 'field_2979',     // Flashcard Bank JSON Store
  lastSaved: 'field_2957',        // Date Last Saved
  box1Data: 'field_2986',         // Box 1 JSON
  box2Data: 'field_2987',         // Box 2 JSON
  box3Data: 'field_2988',         // Box 3 JSON
  box4Data: 'field_2989',         // Box 4 JSON
  box5Data: 'field_2990',         // Box 5 JSON
  colorMapping: 'field_3000'      // Color Mapping
};

// Initialize app when the specific scene renders
$(document).on('knack-scene-render.scene_1206', function(event, scene) {
  console.log("Flashcard app: Scene rendered:", scene.key);
  initializeFlashcardApp();
});

// Helper function to clean HTML from IDs
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
    console.log("Flashcard app: Cleaning HTML from ID:", str);
    
    // If it's wrapped in a span with a class that looks like an ID
    const spanMatch = str.match(/<span class="([^"]+)">([^<]+)<\/span>/);
    if (spanMatch) {
      console.log("Flashcard app: Extracted ID from span class:", spanMatch[1]);
      return spanMatch[1]; // Use the class as the ID, which is often the real ID
    }
    
    // Otherwise just strip all HTML
    const cleanStr = str.replace(/<[^>]+>/g, '').trim();
    console.log("Flashcard app: Stripped HTML from ID:", cleanStr);
    return cleanStr;
  }
  
  return str;
}

// Get complete user data from Knack
function getCompleteUserData(userId, callback) {
  console.log("Flashcard app: Getting complete user data for:", userId);
  
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
      console.log("Flashcard app: Complete user data:", response);
      
      // Store this data for later use
      window.completeUserData = response;
      
      callback(response);
    },
    error: function(error) {
      console.error("Flashcard app: Error retrieving complete user data:", error);
      callback(null);
    }
  });
}

// Initialize the React app
function initializeFlashcardApp() {
  console.log("Initializing Flashcard React app");
  
  // Get config for this scene/view
  const config = FLASHCARD_APP_CONFIG['scene_1206']['view_3005'];
  
  // Check if user is authenticated
  if (typeof Knack !== 'undefined' && Knack.getUserToken()) {
    console.log("Flashcard app: User is authenticated");
    
    // Get user data
    const userToken = Knack.getUserToken();
    const appId = Knack.application_id;
    const user = Knack.getUserAttributes();
    
    console.log("Flashcard app: Basic user info:", user);
    
    // Store the current user globally for later use
    window.currentKnackUser = user;
    
    // Get complete user data including role information
    getCompleteUserData(user.id, function(completeUserData) {
      if (completeUserData) {
        // Enhance the stored user info
        window.currentKnackUser = Object.assign({}, user, completeUserData);
        continueInitialization();
      } else {
        console.log("Flashcard app: Could not get complete user data, continuing with basic info");
        continueInitialization();
      }
    });
    
    function continueInitialization() {
      // Find or create a container for the app
      let container = document.querySelector(config.elementSelector);
    
      // If that doesn't work, try to find any rich text field
      if (!container) {
        console.log("Flashcard app: First selector failed, trying alternatives");
        container = document.querySelector('.kn-rich-text');
      }
      
      // If that still doesn't work, find the view and create a container
      if (!container) {
        console.log("Flashcard app: No rich text field found, looking for the view");
        const view = document.getElementById('view_3005') || document.querySelector('.view_3005');
        
        if (view) {
          console.log("Flashcard app: View found, creating container");
          container = document.createElement('div');
          container.id = 'flashcard-app-container';
          container.style.margin = '20px 0';
          view.appendChild(container);
        }
      }
      
      // Final fallback - just add to the scene
      if (!container) {
        console.log("Flashcard app: No suitable container found, adding to scene");
        const scene = document.getElementById('kn-scene_1206');
        if (scene) {
          container = document.createElement('div');
          container.id = 'flashcard-app-container';
          container.style.margin = '20px 0';
          scene.appendChild(container);
        } else {
          console.error("Flashcard app: Cannot find any suitable container for the app");
          return;
        }
      }
      
      // Clear any existing content
      container.innerHTML = '';
      
      // Create a loading indicator
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'app-loading';
      loadingDiv.innerHTML = '<p>Loading your flashcard app...</p>';
      loadingDiv.style.padding = '20px';
      loadingDiv.style.textAlign = 'center';
      container.appendChild(loadingDiv);
      
      // Create an iframe for the React app
      const iframe = document.createElement('iframe');
      iframe.id = 'flashcard-app-iframe';
      iframe.style.width = '100%';
      iframe.style.height = '800px'; // Adjust as needed
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
        
        console.log("Flashcard app: Message from React app:", event.data);
        
        if (event.data && event.data.type) {
          switch(event.data.type) {
            case 'APP_READY':
              console.log("Flashcard app: React app is ready, sending user info");
              
              // First, get user data from Knack
              loadFlashcardUserData(user.id, function(userData) {
                // Send authentication and user data to the iframe
                iframe.contentWindow.postMessage({
                  type: 'KNACK_USER_INFO',
                  data: {
                    id: user.id,
                    email: user.email,
                    name: user.name || '',
                    token: userToken,
                    appId: appId,
                    userData: userData || {}
                  }
                }, '*');
                
                authSent = true;
                console.log("Flashcard app: Sent user info to React app");
              });
              break;
              
            case 'AUTH_CONFIRMED':
              console.log("Flashcard app: Authentication confirmed by React app");
              
              // Hide loading indicator and show iframe
              loadingDiv.style.display = 'none';
              iframe.style.display = 'block';
              break;
              
            case 'SAVE_DATA':
              console.log("Flashcard app: Saving data from React app:", event.data.data);
              
              // Save the data to Knack
              saveFlashcardUserData(user.id, event.data.data, function(success) {
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
          console.log("Flashcard app: Auth timeout - trying to send again");
          
          // Try to send auth info again
          loadFlashcardUserData(user.id, function(userData) {
            iframe.contentWindow.postMessage({
              type: 'KNACK_USER_INFO',
              data: {
                id: user.id,
                email: user.email,
                name: user.name || '',
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
    console.error("Flashcard app: User is not authenticated");
    // Redirect to login page if needed
    // window.location.href = "/login";
  }
}

// Load flashcard data for a user from Knack
function loadFlashcardUserData(userId, callback) {
  console.log("Flashcard app: Loading user data for:", userId);
  
  // Check if we have a record for this user
  const filters = {
    match: 'and',
    rules: [
      {
        field: FIELD_MAPPING.userId,
        operator: 'is',
        value: userId
      }
    ]
  };
  
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records',
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
      if (response.records && response.records.length > 0) {
        console.log("Flashcard app: Found user data record in Knack:", response.records[0]);
        const record = response.records[0];
        
        // Store the record ID for future updates
        localStorage.setItem('flashcardRecordId_' + userId, record.id);
        
        // Process the data
        const userData = {};
        
        // Process card bank data
        if (record[FIELD_MAPPING.cardBankData]) {
          try {
            userData.cards = JSON.parse(decodeURIComponent(record[FIELD_MAPPING.cardBankData]));
          } catch (e) {
            console.error("Error parsing card bank data:", e);
          }
        }
        
        // Process color mapping
        if (record[FIELD_MAPPING.colorMapping]) {
          try {
            userData.colorMapping = JSON.parse(decodeURIComponent(record[FIELD_MAPPING.colorMapping]));
          } catch (e) {
            console.error("Error parsing color mapping:", e);
          }
        }
        
        // Process boxes data (combine into one array for the React app)
        const allCards = [];
        
        // Process each box
        [
          { field: FIELD_MAPPING.box1Data, boxNum: 1 },
          { field: FIELD_MAPPING.box2Data, boxNum: 2 },
          { field: FIELD_MAPPING.box3Data, boxNum: 3 },
          { field: FIELD_MAPPING.box4Data, boxNum: 4 },
          { field: FIELD_MAPPING.box5Data, boxNum: 5 }
        ].forEach(boxInfo => {
          if (record[boxInfo.field]) {
            try {
              const boxData = JSON.parse(decodeURIComponent(record[boxInfo.field]));
              if (Array.isArray(boxData)) {
                // Add boxNum to each card
                const cardsWithBox = boxData.map(card => ({
                  ...card,
                  boxNum: boxInfo.boxNum,
                  SRFlag: true
                }));
                allCards.push(...cardsWithBox);
              }
            } catch (e) {
              console.error(`Error parsing box ${boxInfo.boxNum} data:`, e);
            }
          }
        });
        
        // If cards were loaded from boxes, use them instead of card bank data
        if (allCards.length > 0) {
          userData.cards = allCards;
        }
        
        // Check if userData.cards is properly structured
        if (userData.cards && !Array.isArray(userData.cards)) {
          // If it's not an array, check if it has a 'cards' property that is an array
          if (userData.cards.cards && Array.isArray(userData.cards.cards)) {
            userData.cards = userData.cards.cards;
          } else {
            // Otherwise, convert to empty array
            userData.cards = [];
          }
        }
        
        callback(userData);
      } else {
        console.log("Flashcard app: No data record found for user");
        
        // Create a new record for this user
        createFlashcardUserRecord(userId, function(success) {
          if (success) {
            callback({ cards: [] });
          } else {
            callback({});
          }
        });
      }
    },
    error: function(error) {
      console.error("Flashcard app: Error loading data from Knack:", error);
      callback({});
    }
  });
}

// Create a new flashcard record for a user
function createFlashcardUserRecord(userId, callback) {
  console.log("Flashcard app: Creating new flashcard record for user:", userId);
  
  // Get the complete user data
  const user = window.currentKnackUser || {};
  
  // Prepare the payload
  const payload = {
    [FIELD_MAPPING.userId]: userId,
    [FIELD_MAPPING.userEmail]: user.email || '',
    [FIELD_MAPPING.accountConnection]: [{ id: userId }],
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
  
  // Add VESPA Customer if available
  if (user.field_122) {
    const cleanedId = cleanHtmlFromId(user.field_122);
    payload[FIELD_MAPPING.vespaCustomer] = { id: cleanedId };
  }
  
  // Create the record
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records',
    type: 'POST',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(payload),
    success: function(response) {
      console.log("Flashcard app: Created new record:", response);
      
      // Store the record ID for future updates
      if (response && response.id) {
        localStorage.setItem('flashcardRecordId_' + userId, response.id);
      }
      
      callback(true);
    },
    error: function(error) {
      console.error("Flashcard app: Error creating record:", error);
      callback(false);
    }
  });
}

// Save flashcard data to Knack
function saveFlashcardUserData(userId, data, callback) {
  console.log("Flashcard app: Saving data for user:", userId);
  
  // Get the record ID
  const recordId = localStorage.getItem('flashcardRecordId_' + userId);
  
  if (!recordId) {
    console.error("Flashcard app: No record ID found");
    callback(false);
    return;
  }
  
  // Prepare the payload
  const payload = {
    [FIELD_MAPPING.lastSaved]: new Date().toISOString()
  };
  
  // Save card bank data
  if (data.cards) {
    payload[FIELD_MAPPING.cardBankData] = encodeURIComponent(JSON.stringify(data.cards));
  }
  
  // Save color mapping
  if (data.colorMapping) {
    payload[FIELD_MAPPING.colorMapping] = encodeURIComponent(JSON.stringify(data.colorMapping));
  }
  
  // Save spaced repetition data if present
  if (data.spacedRepetition) {
    // Box 1
    if (data.spacedRepetition.box1) {
      payload[FIELD_MAPPING.box1Data] = encodeURIComponent(JSON.stringify(data.spacedRepetition.box1));
    }
    
    // Box 2
    if (data.spacedRepetition.box2) {
      payload[FIELD_MAPPING.box2Data] = encodeURIComponent(JSON.stringify(data.spacedRepetition.box2));
    }
    
    // Box 3
    if (data.spacedRepetition.box3) {
      payload[FIELD_MAPPING.box3Data] = encodeURIComponent(JSON.stringify(data.spacedRepetition.box3));
    }
    
    // Box 4
    if (data.spacedRepetition.box4) {
      payload[FIELD_MAPPING.box4Data] = encodeURIComponent(JSON.stringify(data.spacedRepetition.box4));
    }
    
    // Box 5
    if (data.spacedRepetition.box5) {
      payload[FIELD_MAPPING.box5Data] = encodeURIComponent(JSON.stringify(data.spacedRepetition.box5));
    }
  } else {
    // If no specific spaced repetition data, organize cards by box
    const box1Cards = data.cards.filter(card => card.boxNum === 1);
    const box2Cards = data.cards.filter(card => card.boxNum === 2);
    const box3Cards = data.cards.filter(card => card.boxNum === 3);
    const box4Cards = data.cards.filter(card => card.boxNum === 4);
    const box5Cards = data.cards.filter(card => card.boxNum === 5);
    
    if (box1Cards.length > 0) {
      payload[FIELD_MAPPING.box1Data] = encodeURIComponent(JSON.stringify(box1Cards));
    }
    
    if (box2Cards.length > 0) {
      payload[FIELD_MAPPING.box2Data] = encodeURIComponent(JSON.stringify(box2Cards));
    }
    
    if (box3Cards.length > 0) {
      payload[FIELD_MAPPING.box3Data] = encodeURIComponent(JSON.stringify(box3Cards));
    }
    
    if (box4Cards.length > 0) {
      payload[FIELD_MAPPING.box4Data] = encodeURIComponent(JSON.stringify(box4Cards));
    }
    
    if (box5Cards.length > 0) {
      payload[FIELD_MAPPING.box5Data] = encodeURIComponent(JSON.stringify(box5Cards));
    }
  }
  
  // Update the record
  $.ajax({
    url: KNACK_API_URL + '/objects/' + FLASHCARD_OBJECT + '/records/' + recordId,
    type: 'PUT',
    headers: {
      'X-Knack-Application-Id': knackAppId,
      'X-Knack-REST-API-Key': knackApiKey,
      'Authorization': Knack.getUserToken(),
      'Content-Type': 'application/json'
    },
    data: JSON.stringify(payload),
    success: function(response) {
      console.log("Flashcard app: Saved data successfully:", response);
      callback(true);
    },
    error: function(error) {
      console.error("Flashcard app: Error saving data:", error);
      callback(false);
    }
  });
}
