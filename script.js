// ============================================
// Student Vault - Frontend Application
// ============================================

// DOM Element References
const welcomeView = document.getElementById("welcomeView");
const vaultView = document.getElementById("vaultView");
const attendanceView = document.getElementById("attendanceView");
const youtubeView = document.getElementById("youtubeView");
const searchView = document.getElementById("searchView");
const aiView = document.getElementById("aiView");
const imagesView = document.getElementById("imagesView");
const syncView = document.getElementById("syncView");

const mainNav = document.getElementById("mainNav");
const profileMenu = document.getElementById("profileMenu");
const studentName = document.getElementById("studentName");
const brandButton = document.getElementById("brandButton");
const openAttendanceButton = document.getElementById("openAttendanceButton");
const signOutButton = document.getElementById("signOutButton");
const syncButton = document.getElementById("syncButton");
const today = document.getElementById("today");

const loginForm = document.getElementById("loginForm");
const loginName = document.getElementById("loginName");
const loginEmail = document.getElementById("loginEmail");
const loginMessage = document.getElementById("loginMessage");

const topicForm = document.getElementById("topicForm");
const subjectInput = document.getElementById("subjectInput");
const topicInput = document.getElementById("topicInput");
const examDateInput = document.getElementById("examDateInput");
const searchInput = document.getElementById("searchInput");
const subjectFilter = document.getElementById("subjectFilter");
const topicList = document.getElementById("topicList");
const emptyState = document.getElementById("emptyState");
const notice = document.getElementById("notice");

const attendanceForm = document.getElementById("attendanceForm");
const attendanceSubjectInput = document.getElementById("attendanceSubjectInput");
const attendanceGoalInput = document.getElementById("attendanceGoalInput");
const attendanceList = document.getElementById("attendanceList");
const attendanceEmpty = document.getElementById("attendanceEmpty");
const attendanceNotice = document.getElementById("attendanceNotice");
const overallAttendance = document.getElementById("overallAttendance");
const attendancePresent = document.getElementById("attendancePresent");
const attendanceAbsent = document.getElementById("attendanceAbsent");
const attendanceClasses = document.getElementById("attendanceClasses");
const attendanceMessage = document.getElementById("attendanceMessage");

const youtubeSearchForm = document.getElementById("youtubeSearchForm");
const youtubeSearchInput = document.getElementById("youtubeSearchInput");
const youtubeMaxResults = document.getElementById("youtubeMaxResults");
const youtubeOrder = document.getElementById("youtubeOrder");
const youtubeSearchBtn = document.getElementById("youtubeSearchBtn");
const youtubeList = document.getElementById("youtubeList");
const youtubeEmpty = document.getElementById("youtubeEmpty");
const youtubeNotice = document.getElementById("youtubeNotice");
const youtubeStatus = document.getElementById("youtubeStatus");
const youtubeMessage = document.getElementById("youtubeMessage");

const searchForm = document.getElementById("searchForm");
const webSearchInput = document.getElementById("webSearchInput");
const searchMaxResults = document.getElementById("searchMaxResults");
const searchSafeSearch = document.getElementById("searchSafeSearch");
const searchFreshness = document.getElementById("searchFreshness");
const searchBtn = document.getElementById("searchBtn");
const searchList = document.getElementById("searchList");
const searchEmpty = document.getElementById("searchEmpty");
const searchNotice = document.getElementById("searchNotice");
const searchStatus = document.getElementById("searchStatus");
const searchMessage = document.getElementById("searchMessage");

const aiChatForm = document.getElementById("aiChatForm");
const aiChatInput = document.getElementById("aiChatInput");
const aiChatMessages = document.getElementById("aiChatMessages");
const aiProvider = document.getElementById("aiProvider");
const aiChatBtn = document.getElementById("aiChatBtn");
const aiStreamToggle = document.getElementById("aiStreamToggle");
const aiNotice = document.getElementById("aiNotice");
const aiStatus = document.getElementById("aiStatus");
const aiMessage = document.getElementById("aiMessage");

const imagesForm = document.getElementById("imagesForm");
const imagesPrompt = document.getElementById("imagesPrompt");
const imagesNegativePrompt = document.getElementById("imagesNegativePrompt");
const imagesWidth = document.getElementById("imagesWidth");
const imagesHeight = document.getElementById("imagesHeight");
const imagesSteps = document.getElementById("imagesSteps");
const imagesGuidanceScale = document.getElementById("imagesGuidanceScale");
const imagesFormat = document.getElementById("imagesFormat");
const imagesGenerateBtn = document.getElementById("imagesGenerateBtn");
const imagesList = document.getElementById("imagesList");
const imagesEmpty = document.getElementById("imagesEmpty");
const imagesNotice = document.getElementById("imagesNotice");
const imagesStatus = document.getElementById("imagesStatus");
const imagesMessage = document.getElementById("imagesMessage");

const syncPullButton = document.getElementById("syncPullButton");
const syncPushButton = document.getElementById("syncPushButton");
const syncLastSynced = document.getElementById("syncLastSynced");
const syncServerVersion = document.getElementById("syncServerVersion");
const syncNotice = document.getElementById("syncNotice");
const syncStatus = document.getElementById("syncStatus");
const syncMessage = document.getElementById("syncMessage");
const syncConflicts = document.getElementById("syncConflicts");
const syncConflictsList = document.getElementById("syncConflictsList");
const syncStatusInfo = document.getElementById("syncStatusInfo");

const exportButton = document.getElementById("exportButton");
const importInput = document.getElementById("importInput");
const focusMessage = document.getElementById("focusMessage");
const topicCount = document.getElementById("topicCount");
const readyCount = document.getElementById("readyCount");
const resourceCount = document.getElementById("resourceCount");

const toastContainer = document.getElementById("toastContainer");

// State Variables
let profile = null;
let currentUser = null;
let clerkLoaded = false;
let isOnline = navigator.onLine;
let indexedDBAvailable = false;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
let noteSaveTimer = null;

let topics = [];
let attendanceSubjects = [];
const resourcesByTopic = new Map();

// Initialize IndexedDB for file storage
async function initIndexedDB() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      indexedDBAvailable = false;
      resolve();
      return;
    }
    const request = indexedDB.open("StudentVaultDB", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("resources")) {
        db.createObjectStore("resources", { keyPath: "id" });
      }
    };
    request.onsuccess = () => {
      indexedDBAvailable = true;
      resolve();
    };
    request.onerror = () => {
      indexedDBAvailable = false;
      resolve();
    };
  });
}

// Network status listeners
window.addEventListener("online", () => { isOnline = true; });
window.addEventListener("offline", () => { isOnline = false; });

// ============================================
// Utility Functions
// ============================================

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function defaultChecklist() {
  return { understand: false, practice: false, revise: false };
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function validGoal(target) {
  return Number.isInteger(target) && target >= 1 && target <= 100;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss">&times;</button>
  `;
  toastContainer.appendChild(toast);
  
  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.classList.add("toast-hide");
    setTimeout(() => toast.remove(), 200);
  });
  
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("toast-hide");
      setTimeout(() => toast.remove(), 200);
    }
  }, 5000);
}

function setNotice(message) {
  notice.textContent = message;
  setTimeout(() => { notice.textContent = ""; }, 3000);
}

function setAttendanceNotice(message) {
  attendanceNotice.textContent = message;
  setTimeout(() => { attendanceNotice.textContent = ""; }, 3000);
}

function setButtonLoading(button, loading) {
  if (loading) {
    button.classList.add("loading");
    button.disabled = true;
  } else {
    button.classList.remove("loading");
    button.disabled = false;
  }
}

// ============================================
// View Management
// ============================================

function showView(view) {
  const requestedView = view === "vault" && !profile ? "welcome" : view;
  
  welcomeView.hidden = requestedView !== "welcome";
  vaultView.hidden = requestedView !== "vault";
  attendanceView.hidden = requestedView !== "attendance";
  youtubeView.hidden = requestedView !== "youtube";
  searchView.hidden = requestedView !== "search";
  aiView.hidden = requestedView !== "ai";
  imagesView.hidden = requestedView !== "images";
  syncView.hidden = requestedView !== "sync";
  
  mainNav.hidden = requestedView === "welcome";
  profileMenu.hidden = !profile || requestedView === "welcome";
  studentName.textContent = profile?.name || currentUser?.firstName || currentUser?.username || "Student";

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === requestedView);
  });

  history.replaceState(null, "", requestedView === "attendance" ? "#attendance" : requestedView === "#sync" ? "#sync" : "#top");
  
  if (requestedView === "vault") {
    renderTopics();
  }
  if (requestedView === "attendance") {
    renderAttendance();
  }
  if (requestedView === "youtube") {
    loadYouTubeStatus();
  }
  if (requestedView === "search") {
    loadSearchStatus();
  }
  if (requestedView === "ai") {
    loadAIStatus();
  }
  if (requestedView === "images") {
    loadImagesStatus();
  }
  if (requestedView === "sync") {
    loadSyncStatus();
  }
}

// ============================================
// Storage Layer (localStorage + IndexedDB)
// ============================================

function loadProfile() {
  try {
    const data = localStorage.getItem("sv_profile");
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function saveProfile() {
  try {
    if (profile) {
      localStorage.setItem("sv_profile", JSON.stringify(profile));
    } else {
      localStorage.removeItem("sv_profile");
    }
  } catch (error) {
    console.error("Failed to save profile:", error);
  }
}

function loadTopics() {
  try {
    const data = localStorage.getItem("sv_topics");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveTopics() {
  try {
    localStorage.setItem("sv_topics", JSON.stringify(topics));
  } catch (error) {
    console.error("Failed to save topics:", error);
    showToast("Failed to save topics locally.", "warning");
  }
}

function loadAttendanceSubjects() {
  try {
    const data = localStorage.getItem("sv_attendance");
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAttendanceSubjects() {
  try {
    localStorage.setItem("sv_attendance", JSON.stringify(attendanceSubjects));
  } catch (error) {
    console.error("Failed to save attendance:", error);
    showToast("Failed to save attendance locally.", "warning");
  }
}

async function loadResources() {
  if (!indexedDBAvailable) return;
  return new Promise((resolve) => {
    const request = indexedDB.open("StudentVaultDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("resources", "readonly");
      const store = transaction.objectStore("resources");
      const getAllRequest = store.getAll();
      getAllRequest.onsuccess = () => {
        resourcesByTopic.clear();
        for (const resource of getAllRequest.result) {
          const list = resourcesByTopic.get(resource.topicId) || [];
          list.push(resource);
          resourcesByTopic.set(resource.topicId, list);
        }
        resolve();
      };
      getAllRequest.onerror = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

async function saveResources(resources) {
  if (!indexedDBAvailable) return;
  return new Promise((resolve) => {
    const request = indexedDB.open("StudentVaultDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("resources", "readwrite");
      const store = transaction.objectStore("resources");
      for (const resource of resources) {
        store.put(resource);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

async function removeResource(resourceId) {
  if (!indexedDBAvailable) return;
  return new Promise((resolve) => {
    const request = indexedDB.open("StudentVaultDB", 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction("resources", "readwrite");
      const store = transaction.objectStore("resources");
      store.delete(resourceId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    };
    request.onerror = () => resolve();
  });
}

async function removeTopicResources(topicId) {
  if (!indexedDBAvailable) return;
  const resources = resourcesByTopic.get(topicId) || [];
  for (const resource of resources) {
    await removeResource(resource.id);
  }
  resourcesByTopic.delete(topicId);
}

function resourcesFor(topicId) {
  return resourcesByTopic.get(topicId) || [];
}

function getTopicFromElement(element) {
  const card = element.closest("[data-topic-id]");
  if (!card) return null;
  return topics.find((t) => t.id === card.dataset.topicId);
}

// Event Handlers - Core
brandButton.addEventListener("click", () => showView(profile ? "vault" : "welcome"));
openAttendanceButton.addEventListener("click", () => showView("attendance"));
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));

signOutButton.addEventListener("click", async () => {
  await api.signOut();
  profile = null;
  currentUser = null;
  saveProfile();
  showView("welcome");
});

syncButton.addEventListener("click", () => showView("sync"));

// Clerk Authentication
async function initClerk() {
  // Read Clerk publishable key from meta tag (set by backend or build process)
  const metaKey = document.querySelector('meta[name="clerk-publishable-key"]');
  const publishableKey = metaKey?.content?.trim() || "";
  
  if (!publishableKey || publishableKey.includes("your_clerk_key")) {
    console.warn("Clerk publishable key not configured. Using local-only mode.");
    // Load local profile if exists
    profile = loadProfile();
    if (profile) {
      studentName.textContent = profile.name;
      showView(location.hash === "#attendance" ? "attendance" : "vault");
    } else {
      showView("welcome");
    }
    return;
  }
  
  try {
    await api.initClerk(publishableKey);
    clerkLoaded = true;
    
    // Listen for auth changes
    window.addEventListener("clerk:auth-change", ({ detail }) => {
      currentUser = detail.user;
      if (detail.session) {
        profile = { name: detail.user?.firstName || detail.user?.username || "Student" };
        studentName.textContent = profile.name;
        saveProfile();
        if (!welcomeView.hidden) showView("vault");
      } else {
        profile = null;
        currentUser = null;
        saveProfile();
        showView("welcome");
      }
    });
    
    // Check existing session
    if (api.isSignedIn()) {
      currentUser = api.getCurrentUser();
      profile = { name: currentUser?.firstName || currentUser?.username || "Student" };
      studentName.textContent = profile.name;
      saveProfile();
      showView(location.hash === "#attendance" ? "attendance" : "vault");
    } else {
      profile = loadProfile();
      if (profile) {
        studentName.textContent = profile.name;
        showView(location.hash === "#attendance" ? "attendance" : "vault");
      } else {
        showView("welcome");
      }
    }
  } catch (error) {
    console.error("Clerk initialization failed:", error);
    // Fallback to local mode
    profile = loadProfile();
    if (profile) {
      studentName.textContent = profile.name;
      showView(location.hash === "#attendance" ? "attendance" : "vault");
    } else {
      showView("welcome");
    }
  }
}

// ============================================
// API Wrapper Functions
// ============================================

async function loadTopicsFromAPI() {
  if (!isOnline || !api.isSignedIn()) return false;
  try {
    const data = await api.topics.list({ limit: 100 });
    if (data.topics && data.topics.length > 0) {
      topics = data.topics;
      saveTopics();
      
      // Load resources for each topic
      for (const topic of topics) {
        const resources = await api.resources.list({ topicId: topic.id });
        if (resources.resources) {
          resourcesByTopic.set(topic.id, resources.resources);
          await saveResources(resources.resources);
        }
      }
      return true;
    }
  } catch (error) {
    console.error("Failed to load topics from API:", error);
  }
  return false;
}

async function loadAttendanceFromAPI() {
  if (!isOnline || !api.isSignedIn()) return false;
  try {
    const data = await api.attendance.list();
    if (data.subjects && data.subjects.length > 0) {
      attendanceSubjects = data.subjects;
      saveAttendanceSubjects();
      return true;
    }
  } catch (error) {
    console.error("Failed to load attendance from API:", error);
  }
  return false;
}

async function loadResourcesFromAPI() {
  if (!isOnline || !api.isSignedIn()) return false;
  try {
    const data = await api.resources.list({ limit: 500 });
    if (data.resources && data.resources.length > 0) {
      resourcesByTopic.clear();
      for (const resource of data.resources) {
        const list = resourcesByTopic.get(resource.topicId) || [];
        list.push(resource);
        resourcesByTopic.set(resource.topicId, list);
      }
      await saveResources(data.resources);
      return true;
    }
  } catch (error) {
    console.error("Failed to load resources from API:", error);
  }
  return false;
}

async function createTopicAPI(topic) {
  const response = await api.topics.create(topic);
  return response.topic;
}

async function updateTopicAPI(id, data) {
  const response = await api.topics.update(id, data);
  return response.topic;
}

async function updateTopicChecklistAPI(id, checklist) {
  const response = await api.topics.updateChecklist(id, checklist);
  return response.topic;
}

async function deleteTopicAPI(id) {
  await api.topics.delete(id);
}

async function deleteResourceAPI(resourceId) {
  await api.resources.delete(resourceId);
}

async function createResourceAPI(resource) {
  const response = await api.resources.create(resource);
  return response.resource;
}

async function createAttendanceAPI(data) {
  const response = await api.attendance.create(data);
  return response.subject;
}

async function addAttendanceRecordAPI(id, record) {
  const response = await api.attendance.addRecord(id, record);
  return response.subject;
}

async function undoAttendanceRecordAPI(id) {
  const response = await api.attendance.undoRecord(id);
  return response.subject;
}

async function deleteAttendanceAPI(id) {
  await api.attendance.delete(id);
}

async function updateAttendanceTargetAPI(id, target) {
  const response = await api.attendance.updateTarget(id, target);
  return response.subject;
}

async function searchYouTube(query, options) {
  const response = await api.youtube.search({ query, ...options });
  return response;
}

async function searchWeb(query, options) {
  const response = await api.search.search({ query, ...options });
  return response;
}

async function sendAIMessage(messages) {
  if (!isOnline) {
    showToast("AI chat requires an internet connection.", "error");
    return;
  }
  
  // Add loading message
  const loadingId = createId();
  aiChatMessages.innerHTML += `
    <div class="ai-message ai-response loading" data-message-id="${loadingId}">
      <div class="ai-content">Thinking...</div>
    </div>
  `;
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  
  try {
    const stream = aiStreamToggle?.checked;
    const provider = aiProvider?.value || undefined;
    
    if (stream) {
      await handleAIStream(messages, provider, loadingId);
    } else {
      const response = await api.ai.chat({ messages, provider });
      replaceAIMessage(loadingId, response.content, false, response.usage);
    }
  } catch (error) {
    replaceAIMessage(loadingId, `Error: ${error.message}`, true);
    showToast("AI request failed: " + error.message, "error");
  }
}

async function handleAIStream(messages, provider, loadingId) {
  try {
    const stream = await api.ai.chatStream({ messages, provider, stream: true });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";
    let usage = null;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullContent += parsed.content;
              replaceAIMessage(loadingId, fullContent, false, null, true);
            }
            if (parsed.usage) {
              usage = parsed.usage;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
    
    replaceAIMessage(loadingId, fullContent, false, usage);
  } catch (error) {
    replaceAIMessage(loadingId, `Error: ${error.message}`, true);
    throw error;
  }
}

function replaceAIMessage(messageId, content, isError, usage = null, isStreaming = false) {
  const messageEl = aiChatMessages.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  messageEl.classList.remove("loading", "streaming");
  if (isError) messageEl.classList.add("error");
  if (isStreaming) messageEl.classList.add("streaming");
  
  const contentEl = messageEl.querySelector(".ai-content");
  if (contentEl) {
    contentEl.textContent = content;
  }
  
  if (usage) {
    const usageEl = document.createElement("div");
    usageEl.className = "ai-usage";
    usageEl.textContent = `Tokens: ${usage.total_tokens || usage.total || "?"} (prompt: ${usage.prompt_tokens || usage.prompt || "?"}, completion: ${usage.completion_tokens || usage.completion || "?"})`;
    messageEl.appendChild(usageEl);
  }
  
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

async function generateImage(params) {
  if (!isOnline) {
    throw new Error("Image generation requires an internet connection.");
  }
  const response = await api.images.generate(params);
  return response;
}

async function loadYouTubeStatus() {
  if (!isOnline) {
    youtubeStatus.hidden = true;
    return;
  }
  try {
    const data = await api.youtube.status();
    youtubeStatus.hidden = false;
    youtubeStatus.textContent = data.enabled ? "YouTube: Connected" : "YouTube: Not configured";
    youtubeStatus.className = "service-status " + (data.enabled ? "connected" : "disconnected");
  } catch {
    youtubeStatus.hidden = false;
    youtubeStatus.textContent = "YouTube: Error";
    youtubeStatus.className = "service-status error";
  }
}

async function loadSearchStatus() {
  if (!isOnline) {
    searchStatus.hidden = true;
    return;
  }
  try {
    const data = await api.search.status();
    searchStatus.hidden = false;
    searchStatus.textContent = data.enabled ? "Search: Connected" : "Search: Not configured";
    searchStatus.className = "service-status " + (data.enabled ? "connected" : "disconnected");
  } catch {
    searchStatus.hidden = false;
    searchStatus.textContent = "Search: Error";
    searchStatus.className = "service-status error";
  }
}

async function loadAIStatus() {
  if (!isOnline) {
    aiStatus.hidden = true;
    return;
  }
  try {
    const data = await api.ai.providers();
    aiStatus.hidden = false;
    const available = data.providers && data.providers.length > 0;
    aiStatus.textContent = available ? `AI: ${data.providers.join(", ")}` : "AI: Not configured";
    aiStatus.className = "service-status " + (available ? "connected" : "disconnected");
    
    // Populate provider dropdown
    if (aiProvider) {
      aiProvider.innerHTML = '<option value="">Auto</option>';
      for (const provider of data.providers || []) {
        const option = document.createElement("option");
        option.value = provider;
        option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
        aiProvider.appendChild(option);
      }
    }
  } catch {
    aiStatus.hidden = false;
    aiStatus.textContent = "AI: Error";
    aiStatus.className = "service-status error";
  }
}

async function loadImagesStatus() {
  if (!isOnline) {
    imagesStatus.hidden = true;
    return;
  }
  try {
    const data = await api.images.status();
    imagesStatus.hidden = false;
    imagesStatus.textContent = data.enabled ? "Images: Connected" : "Images: Not configured";
    imagesStatus.className = "service-status " + (data.enabled ? "connected" : "disconnected");
  } catch {
    imagesStatus.hidden = false;
    imagesStatus.textContent = "Images: Error";
    imagesStatus.className = "service-status error";
  }
}

async function loadSyncStatus() {
  if (!isOnline || !api.isSignedIn()) {
    syncStatus.hidden = true;
    syncStatusInfo.hidden = true;
    return;
  }
  try {
    const data = await api.sync.status();
    syncStatus.hidden = false;
    syncStatus.textContent = "Sync: Connected";
    syncStatus.className = "service-status connected";
    
    syncStatusInfo.hidden = false;
    syncLastSynced.textContent = data.lastSynced ? new Date(data.lastSynced).toLocaleString() : "Never";
    syncServerVersion.textContent = data.serverVersion || "--";
  } catch {
    syncStatus.hidden = false;
    syncStatus.textContent = "Sync: Error";
    syncStatus.className = "service-status error";
    syncStatusInfo.hidden = true;
  }
}

// ============================================
// Render Functions
// ============================================

function renderTopics() {
  const searchTerm = searchInput?.value?.toLowerCase() || "";
  const subjectFilterValue = subjectFilter?.value || "all";
  
  let filtered = topics;
  if (searchTerm) {
    filtered = filtered.filter(t => 
      t.subject.toLowerCase().includes(searchTerm) || 
      t.title.toLowerCase().includes(searchTerm) ||
      t.notes.toLowerCase().includes(searchTerm)
    );
  }
  if (subjectFilterValue !== "all") {
    filtered = filtered.filter(t => t.subject === subjectFilterValue);
  }
  
  // Update subject filter options
  const subjects = [...new Set(topics.map(t => t.subject))].sort();
  if (subjectFilter) {
    const currentValue = subjectFilter.value;
    subjectFilter.innerHTML = '<option value="all">All subjects</option>';
    for (const subject of subjects) {
      const option = document.createElement("option");
      option.value = subject;
      option.textContent = subject;
      subjectFilter.appendChild(option);
    }
    subjectFilter.value = currentValue;
  }
  
  // Update stats
  if (topicCount) topicCount.textContent = topics.length;
  if (readyCount) readyCount.textContent = topics.filter(t => t.status === "ready").length;
  if (resourceCount) {
    let totalResources = 0;
    for (const list of resourcesByTopic.values()) {
      totalResources += list.length;
    }
    resourceCount.textContent = totalResources;
  }
  
  // Update focus message
  if (focusMessage) {
    const nextTopic = topics.find(t => t.status === "learning");
    if (nextTopic) {
      focusMessage.textContent = `Next up: ${nextTopic.subject} — ${nextTopic.title}`;
    } else if (topics.length > 0) {
      focusMessage.textContent = "All topics marked as ready. Great job!";
    } else {
      focusMessage.textContent = "Your next topic starts here.";
    }
  }
  
  // Render topic list
  if (emptyState) emptyState.hidden = filtered.length > 0;
  if (topicList) {
    topicList.innerHTML = "";
    if (filtered.length === 0) return;
    
    for (const topic of filtered) {
      const resources = resourcesFor(topic.id);
      const colorIndex = subjects.indexOf(topic.subject) % 5;
      
      const card = document.createElement("article");
      card.className = "topic-card";
      card.dataset.topicId = topic.id;
      card.dataset.colorIndex = colorIndex;
      
      const examDate = topic.examDate ? new Date(topic.examDate).toLocaleDateString() : "No exam date";
      const examDateClass = topic.examDate && new Date(topic.examDate) < new Date() ? "exam-date overdue" : "exam-date";
      const progress = Object.values(topic.checklist).filter(Boolean).length;
      const totalChecks = Object.keys(topic.checklist).length;
      
      card.innerHTML = `
        <div class="topic-card-head">
          <div class="topic-kicker">
            <span class="subject-name">${escapeHtml(topic.subject)}</span>
            <span class="progress-badge">${progress}/${totalChecks}</span>
          </div>
          <h3>${escapeHtml(topic.title)}</h3>
          <p class="${examDateClass}">${examDate}${topic.examDate && new Date(topic.examDate) < new Date() ? " (Overdue)" : ""}</p>
        </div>
        
        <div class="topic-meta">
          <label>
            <span class="sr-only">Status</span>
            <select data-field="status">
              <option value="learning" ${topic.status === "learning" ? "selected" : ""}>Learning</option>
              <option value="reviewing" ${topic.status === "reviewing" ? "selected" : ""}>Reviewing</option>
              <option value="ready" ${topic.status === "ready" ? "selected" : ""}>Ready</option>
            </select>
          </label>
          <label>
            <span class="sr-only">Exam date</span>
            <input type="date" data-field="examDate" value="${topic.examDate || ""}">
          </label>
          <a href="#" class="research-link" data-action="research">Browse sources</a>
        </div>
        
        <div class="notes-field">
          <label for="notes-${topic.id}">Notes</label>
          <textarea id="notes-${topic.id}" data-field="notes" rows="3" placeholder="Add revision notes...">${escapeHtml(topic.notes)}</textarea>
        </div>
        
        <fieldset class="revision-checklist">
          <legend>Revision checklist</legend>
          <div class="check-item">
            <input type="checkbox" id="check-understand-${topic.id}" data-check="understand" ${topic.checklist.understand ? "checked" : ""}>
            <label for="check-understand-${topic.id}">Understand concepts</label>
          </div>
          <div class="check-item">
            <input type="checkbox" id="check-practice-${topic.id}" data-check="practice" ${topic.checklist.practice ? "checked" : ""}>
            <label for="check-practice-${topic.id}">Practice problems</label>
          </div>
          <div class="check-item">
            <input type="checkbox" id="check-revise-${topic.id}" data-check="revise" ${topic.checklist.revise ? "checked" : ""}>
            <label for="check-revise-${topic.id}">Final revision</label>
          </div>
        </fieldset>
        
        <div class="resources-section">
          <div class="resources-heading">
            <h4>Resources</h4>
            <label class="attach-control">
              <span>Attach PDF or photo</span>
              <input type="file" class="attachment-input" accept=".pdf,image/*" data-topic-id="${topic.id}">
            </label>
          </div>
          <ul class="resource-list" role="list">
            ${resources.length === 0 ? '<li class="resource-item"><span class="resource-details"><span class="resource-name">No resources attached</span></span></li>' : resources.map(r => `
              <li class="resource-item" data-resource-id="${r.id}">
                <span class="resource-type ${r.type.startsWith("image/") ? "photo" : ""}">${r.type.startsWith("image/") ? "IMG" : "PDF"}</span>
                <div class="resource-details">
                  <span class="resource-name">${escapeHtml(r.name)}</span>
                  <span class="resource-size">${formatFileSize(r.size)}</span>
                </div>
                <div class="resource-actions">
                  <button type="button" data-action="open-resource">Open</button>
                  <button type="button" data-action="remove-resource">Remove</button>
                </div>
              </li>
            `).join("")}
          </ul>
        </div>
        
        <div class="topic-card-footer">
          <p class="storage-note">${resources.length} resource(s) • Updated ${new Date(topic.updatedAt).toLocaleDateString()}</p>
          <div>
            <button type="button" class="edit-topic" data-action="edit-topic">Edit</button>
            <button type="button" class="delete-topic" data-action="delete-topic">Delete</button>
          </div>
        </div>
      `;
      
      topicList.appendChild(card);
    }
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderAttendance() {
  // Calculate overall stats
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalClasses = 0;
  
  for (const subject of attendanceSubjects) {
    totalPresent += subject.records.filter(r => r === "present").length;
    totalAbsent += subject.records.filter(r => r === "absent").length;
    totalClasses += subject.records.length;
  }
  
  const overallPercentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;
  
  if (overallAttendance) overallAttendance.textContent = totalClasses > 0 ? overallPercentage + "%" : "--";
  if (attendancePresent) attendancePresent.textContent = totalPresent;
  if (attendanceAbsent) attendanceAbsent.textContent = totalAbsent;
  if (attendanceClasses) attendanceClasses.textContent = totalClasses;
  
  if (attendanceEmpty) attendanceEmpty.hidden = attendanceSubjects.length > 0;
  if (attendanceList) {
    attendanceList.innerHTML = "";
    if (attendanceSubjects.length === 0) return;
    
    for (const subject of attendanceSubjects) {
      const present = subject.records.filter(r => r === "present").length;
      const absent = subject.records.filter(r => r === "absent").length;
      const total = subject.records.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      const isOnGoal = percentage >= subject.target;
      const isBelowGoal = total > 0 && percentage < subject.target;
      
      const card = document.createElement("article");
      card.className = `attendance-card ${isBelowGoal ? "is-below-goal" : ""} ${isOnGoal ? "is-on-goal" : ""}`;
      card.dataset.attendanceId = subject.id;
      
      card.innerHTML = `
        <div class="attendance-card-head">
          <h3>${escapeHtml(subject.name)}</h3>
          <span class="attendance-percent">${total > 0 ? percentage + "%" : "--"}</span>
        </div>
        
        <div class="attendance-stats-card">
          <div>
            <span>${present}</span>
            <small>Present</small>
          </div>
          <div>
            <span>${absent}</span>
            <small>Absent</small>
          </div>
          <div>
            <span>${total}</span>
            <small>Total</small>
          </div>
        </div>
        
        <div class="attendance-actions">
          <button type="button" class="mark-present" data-attendance-action="present" ${total >= 100 ? "disabled" : ""}>Mark Present</button>
          <button type="button" class="mark-absent" data-attendance-action="absent" ${total >= 100 ? "disabled" : ""}>Mark Absent</button>
        </div>
        
        <div class="attendance-footer">
          <label class="attendance-goal">
            Goal: <input type="number" min="1" max="100" value="${subject.target}" data-attendance-action="target" aria-label="Attendance goal percentage">%
          </label>
          <div class="attendance-secondary">
            <button type="button" class="undo-mark" data-attendance-action="undo" ${total === 0 ? "disabled" : ""}>Undo</button>
            <button type="button" class="remove-subject" data-attendance-action="remove">Remove</button>
          </div>
        </div>
      `;
      
      attendanceList.appendChild(card);
    }
  }
}

function renderYouTubeResults(videos) {
  if (youtubeEmpty) youtubeEmpty.hidden = videos && videos.length > 0;
  if (youtubeList) {
    youtubeList.innerHTML = "";
    if (!videos || videos.length === 0) return;
    
    for (const video of videos) {
      const card = document.createElement("article");
      card.className = "youtube-card";
      card.innerHTML = `
        <a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener">
          <img src="${video.thumbnail}" alt="" loading="lazy">
        </a>
        <div class="youtube-info">
          <h3><a href="https://www.youtube.com/watch?v=${video.id}" target="_blank" rel="noopener">${escapeHtml(video.title)}</a></h3>
          <p class="youtube-channel">${escapeHtml(video.channelTitle)}</p>
          <p class="youtube-meta">${formatNumber(video.viewCount)} views • ${formatDate(video.publishedAt)}</p>
          <p class="youtube-desc">${escapeHtml(video.description?.slice(0, 200) || "")}...</p>
        </div>
      `;
      youtubeList.appendChild(card);
    }
  }
}

function renderSearchResults(results) {
  if (searchEmpty) searchEmpty.hidden = results && results.length > 0;
  if (searchList) {
    searchList.innerHTML = "";
    if (!results || results.length === 0) return;
    
    for (const result of results) {
      const card = document.createElement("article");
      card.className = "search-result";
      card.innerHTML = `
        <h3><a href="${result.url}" target="_blank" rel="noopener">${escapeHtml(result.title)}</a></h3>
        <p class="search-url">${escapeHtml(result.url)}</p>
        <p class="search-snippet">${escapeHtml(result.snippet)}</p>
        <div class="search-meta">
          <span class="search-source">${escapeHtml(result.source || "Web")}</span>
          <span class="search-date">${result.date ? formatDate(result.date) : ""}</span>
        </div>
      `;
      searchList.appendChild(card);
    }
  }
}

function renderImages(images) {
  if (imagesEmpty) imagesEmpty.hidden = images && images.length > 0;
  if (imagesList) {
    imagesList.innerHTML = "";
    if (!images || images.length === 0) return;
    
    for (const image of images) {
      const card = document.createElement("article");
      card.className = "image-card";
      card.innerHTML = `
        <img src="${image.url}" alt="${escapeHtml(image.prompt)}" loading="lazy">
        <div class="image-info">
          <p class="image-prompt">${escapeHtml(image.prompt)}</p>
          <p class="image-meta">${image.width}×${image.height} • ${image.format} • ${image.steps} steps</p>
        </div>
      `;
      imagesList.appendChild(card);
    }
  }
}

function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// Login Form
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = loginName.value.trim();
  const email = loginEmail.value.trim();
  
  if (!name) {
    loginMessage.textContent = "Enter your name to continue.";
    return;
  }
  
  // If Clerk is configured, use it
  if (clerkLoaded) {
    loginMessage.textContent = "Redirecting to sign in...";
    await api.signIn();
    return;
  }
  
  // Fallback local mode
  profile = { name: name.slice(0, 40), email };
  saveProfile();
  studentName.textContent = profile.name;
  loginForm.reset();
  loginMessage.textContent = "";
  showView("vault");
});

// Topic Event Handlers
topicForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const subject = subjectInput.value.trim();
  const title = topicInput.value.trim();
  if (!subject || !title) { showToast("Enter both a subject and topic.", "error"); return; }
  
  const newTopic = {
    id: createId(), subject, title, examDate: examDateInput.value,
    notes: "", status: "learning", checklist: defaultChecklist(),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  };
  
  // Optimistic UI update
  topics.unshift(newTopic);
  saveTopics();
  renderTopics();
  
  // Sync to API
  if (isOnline) {
    try {
      const saved = await createTopicAPI(newTopic);
      if (saved) {
        // Replace optimistic with server version
        topics = topics.map(t => t.id === newTopic.id ? saved : t);
        saveTopics();
        renderTopics();
      }
    } catch (error) {
      showToast("Failed to sync topic: " + error.message, "warning");
    }
  }
  
  setNotice("Topic created.");
  topicForm.reset();
  subjectInput.focus();
});

searchInput.addEventListener("input", renderTopics);
subjectFilter.addEventListener("change", renderTopics);

topicList.addEventListener("input", (event) => {
  if (event.target.dataset.field !== "notes") return;
  const topic = getTopicFromElement(event.target);
  if (!topic) return;
  topic.notes = event.target.value;
  window.clearTimeout(noteSaveTimer);
  noteSaveTimer = window.setTimeout(async () => {
    saveTopics();
    if (isOnline) await updateTopicAPI(topic.id, { notes: topic.notes });
    showToast("Notes saved.", "success");
  }, 350);
});

topicList.addEventListener("change", async (event) => {
  const topic = getTopicFromElement(event.target);
  if (!topic) return;
  
  if (event.target.classList.contains("attachment-input")) {
    await attachFiles(topic, [...event.target.files]);
    return;
  }
  
  if (event.target.dataset.field === "status" || event.target.dataset.field === "examDate") {
    topic[event.target.dataset.field] = event.target.value;
    saveTopics();
    if (isOnline) await updateTopicAPI(topic.id, { [event.target.dataset.field]: event.target.value });
    renderTopics();
    return;
  }
  
  if (event.target.dataset.check) {
    topic.checklist[event.target.dataset.check] = event.target.checked;
    saveTopics();
    if (isOnline) await updateTopicChecklistAPI(topic.id, topic.checklist);
    renderTopics();
  }
});

topicList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const topic = getTopicFromElement(button);
  if (!topic) return;
  
  if (button.dataset.action === "edit-topic") {
    const title = window.prompt("Topic name", topic.title);
    if (title === null) return;
    if (!title.trim()) { showToast("A topic needs a name.", "error"); return; }
    topic.title = title.trim().slice(0, 80);
    saveTopics();
    if (isOnline) await updateTopicAPI(topic.id, { title: topic.title });
    renderTopics();
    return;
  }
  
  if (button.dataset.action === "delete-topic") {
    if (!window.confirm(`Delete ${topic.title} and its saved resources?`)) return;
    try {
      await removeTopicResources(topic.id);
      if (isOnline) await deleteResourceAPI(topic.id);
    } catch { showToast("The topic was removed, but some saved files may remain in this browser.", "warning"); }
    resourcesByTopic.delete(topic.id);
    topics = topics.filter((item) => item.id !== topic.id);
    saveTopics();
    if (isOnline) await deleteTopicAPI(topic.id);
    renderTopics();
    return;
  }
  
  const resourceItem = button.closest("[data-resource-id]");
  const resource = resourcesFor(topic.id).find((item) => item.id === resourceItem?.dataset.resourceId);
  if (!resource) return;
  
  if (button.dataset.action === "open-resource") {
    const url = resource.downloadUrl || resource.data;
    if (url) window.open(url, "_blank", "noopener");
    return;
  }
  
  if (button.dataset.action === "remove-resource") {
    if (!window.confirm(`Remove ${resource.name}?`)) return;
    try {
      await removeResource(resource.id);
      if (isOnline) await deleteResourceAPI(resource.id);
      resourcesByTopic.set(topic.id, resourcesFor(topic.id).filter((item) => item.id !== resource.id));
      showToast("Resource removed.", "success");
      renderTopics();
    } catch { showToast("The resource could not be removed.", "error"); }
  }
});

// File Attachments with R2 Support
async function attachFiles(topic, files) {
  if (!indexedDBAvailable) {
    showToast("File storage is not available in this browser.", "error");
    return;
  }
  
  const accepted = files.filter((file) => file.type === "application/pdf" || file.type.startsWith("image/"));
  const tooLarge = accepted.filter((file) => file.size > MAX_FILE_SIZE);
  const acceptedFiles = accepted.filter((file) => file.size <= MAX_FILE_SIZE);
  
  if (acceptedFiles.length === 0) {
    showToast("Choose a PDF or image smaller than 20 MB.", "error");
    return;
  }
  
  const totalSize = acceptedFiles.reduce((sum, f) => sum + f.size, 0);
  const hasQuota = await checkQuota(totalSize);
  if (!hasQuota) {
    showToast("Not enough storage space. Clear some data and try again.", "error");
    return;
  }
  
  for (const file of acceptedFiles) {
    try {
      let resource;
      if (isOnline && api.isServiceEnabled("images")) {
        // Try R2 upload first
        const resourceId = createId();
        resource = await uploadResourceToR2(resourceId, file, topic.id);
      }
      
      if (!resource) {
        // Fallback to base64
        const dataUrl = await fileToBase64(file);
        resource = { id: createId(), topicId: topic.id, name: file.name, type: file.type, size: file.size, data: dataUrl, addedAt: new Date().toISOString() };
        if (isOnline) {
          resource = await createResourceAPI({ ...resource, data: dataUrl });
        }
      }
      
      if (resource) {
        const list = resourcesByTopic.get(topic.id) || [];
        list.push(resource);
        resourcesByTopic.set(topic.id, list);
        await saveResources([resource]);
      }
    } catch (error) {
      showToast(`Failed to process ${file.name}: ${error.message}`, "error");
      return;
    }
  }
  
  if (tooLarge.length) {
    showToast("Some files were skipped because they are over 20 MB.", "warning");
  } else {
    showToast("Resource saved.", "success");
  }
  renderTopics();
}

// Attendance Event Handlers
attendanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = attendanceSubjectInput.value.trim();
  const target = Number(attendanceGoalInput.value);
  if (!name) { showToast("Enter a subject name.", "error"); attendanceSubjectInput.focus(); return; }
  if (!validGoal(target)) { showToast("The goal must be a whole number from 1 to 100.", "error"); attendanceGoalInput.focus(); return; }
  if (attendanceSubjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
    showToast("That subject is already in your list.", "error");
    return;
  }
  
  const newSubject = { id: createId(), name, target, records: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  
  attendanceSubjects.unshift(newSubject);
  saveAttendanceSubjects();
  renderAttendance();
  
  if (isOnline) {
    try {
      const saved = await createAttendanceAPI({ name, target });
      if (saved) {
        attendanceSubjects = attendanceSubjects.map(s => s.id === newSubject.id ? saved : s);
        saveAttendanceSubjects();
        renderAttendance();
      }
    } catch (error) {
      showToast("Failed to sync attendance subject: " + error.message, "warning");
    }
  }
  
  setAttendanceNotice("Subject added.");
  attendanceSubjectInput.value = "";
  attendanceSubjectInput.focus();
});

attendanceList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-attendance-action]");
  if (!button) return;
  const card = button.closest("[data-attendance-id]");
  const subject = attendanceSubjects.find((item) => item.id === card?.dataset.attendanceId);
  if (!subject) return;
  const action = button.dataset.attendanceAction;
  
  if (action === "present" || action === "absent") {
    subject.records.push(action);
    saveAttendanceSubjects();
    if (isOnline) await addAttendanceRecordAPI(subject.id, action);
    renderAttendance();
  }
  if (action === "undo") {
    subject.records.pop();
    saveAttendanceSubjects();
    if (isOnline) await undoAttendanceRecordAPI(subject.id);
    renderAttendance();
  }
  if (action === "remove") {
    if (!window.confirm(`Remove ${subject.name} and its attendance records?`)) return;
    attendanceSubjects = attendanceSubjects.filter((item) => item.id !== subject.id);
    saveAttendanceSubjects();
    if (isOnline) await deleteAttendanceAPI(subject.id);
    renderAttendance();
  }
});

attendanceList.addEventListener("change", async (event) => {
  if (event.target.dataset.attendanceAction !== "target") return;
  const card = event.target.closest("[data-attendance-id]");
  const subject = attendanceSubjects.find((item) => item.id === card?.dataset.attendanceId);
  const target = Number(event.target.value);
  if (!subject) return;
  if (!validGoal(target)) { event.target.value = subject.target; return; }
  subject.target = target;
  saveAttendanceSubjects();
  if (isOnline) await updateAttendanceTargetAPI(subject.id, target);
  renderAttendance();
});

// YouTube Event Handlers
youtubeSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = youtubeSearchInput.value.trim();
  if (!query) return;
  
  youtubeNotice.textContent = "Searching...";
  youtubeList.innerHTML = "";
  youtubeEmpty.hidden = true;
  
  try {
    const results = await searchYouTube(query, {
      maxResults: Number(youtubeMaxResults.value) || 10,
      order: youtubeOrder.value || "relevance"
    });
    renderYouTubeResults(results.videos || results);
    youtubeNotice.textContent = "";
  } catch (error) {
    youtubeNotice.textContent = "Search failed: " + error.message;
    youtubeEmpty.hidden = false;
  }
});

// Search Event Handlers
searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const query = webSearchInput.value.trim();
  if (!query) return;
  
  searchNotice.textContent = "Searching...";
  searchList.innerHTML = "";
  searchEmpty.hidden = true;
  
  try {
    const results = await searchWeb(query, {
      maxResults: Number(searchMaxResults.value) || 10,
      safeSearch: searchSafeSearch.value || "moderate",
      freshness: searchFreshness.value || undefined
    });
    renderSearchResults(results);
    searchNotice.textContent = "";
  } catch (error) {
    searchNotice.textContent = "Search failed: " + error.message;
    searchEmpty.hidden = false;
  }
});

// AI Assistant Event Handlers
aiChatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = aiChatInput.value.trim();
  if (!content) return;
  
  // Add user message to chat
  aiChatMessages.innerHTML += `<div class="ai-message ai-user">${escapeHtml(content)}</div>`;
  aiChatInput.value = "";
  aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
  
  const messages = [
    { role: "system", content: "You are a helpful study assistant for students. Provide clear, concise explanations and study tips." },
    { role: "user", content }
  ];
  
  await sendAIMessage(messages);
});

// Image Generation Event Handlers
imagesForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const prompt = imagesPrompt.value.trim();
  if (!prompt) return;
  
  imagesNotice.textContent = "Generating...";
  imagesList.innerHTML = "";
  imagesEmpty.hidden = true;
  
  try {
    const response = await generateImage({
      prompt,
      negativePrompt: imagesNegativePrompt.value.trim() || undefined,
      width: Number(imagesWidth.value) || 512,
      height: Number(imagesHeight.value) || 512,
      steps: Number(imagesSteps.value) || 20,
      guidanceScale: Number(imagesGuidanceScale.value) || 7.5,
      format: imagesFormat.value || "png"
    });
    
    renderImages(response.images || []);
    imagesNotice.textContent = "";
  } catch (error) {
    imagesNotice.textContent = "Generation failed: " + error.message;
    imagesEmpty.hidden = false;
  }
});

// ============================================
// File Attachment Functions
// ============================================

async function checkQuota(requiredBytes) {
  if (!indexedDBAvailable) return true;
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const available = (estimate.quota || 0) - (estimate.usage || 0);
      return available >= requiredBytes;
    }
  } catch {
    // Ignore quota check errors
  }
  return true;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadResourceToR2(resourceId, file, topicId) {
  if (!isOnline || !api.isSignedIn()) return null;
  
  try {
    const uploadData = await api.sync.getUploadUrl(resourceId, file.name, file.type);
    if (!uploadData.uploadUrl) return null;
    
    const response = await fetch(uploadData.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type }
    });
    
    if (!response.ok) return null;
    
    const resource = {
      id: resourceId,
      topicId,
      name: file.name,
      type: file.type,
      size: file.size,
      r2Key: uploadData.key,
      downloadUrl: uploadData.downloadUrl,
      addedAt: new Date().toISOString()
    };
    
    const saved = await createResourceAPI(resource);
    return saved.resource || resource;
  } catch (error) {
    console.error("R2 upload failed:", error);
    return null;
  }
}

async function attachFiles(topic, files) {
  if (!indexedDBAvailable) {
    showToast("File storage is not available in this browser.", "error");
    return;
  }
  
  const accepted = files.filter((file) => file.type === "application/pdf" || file.type.startsWith("image/"));
  const tooLarge = accepted.filter((file) => file.size > MAX_FILE_SIZE);
  const acceptedFiles = accepted.filter((file) => file.size <= MAX_FILE_SIZE);
  
  if (acceptedFiles.length === 0) {
    showToast("Choose a PDF or image smaller than 20 MB.", "error");
    return;
  }
  
  const totalSize = acceptedFiles.reduce((sum, f) => sum + f.size, 0);
  const hasQuota = await checkQuota(totalSize);
  if (!hasQuota) {
    showToast("Not enough storage space. Clear some data and try again.", "error");
    return;
  }
  
  for (const file of acceptedFiles) {
    try {
      let resource;
      if (isOnline && api.isSignedIn()) {
        const resourceId = createId();
        resource = await uploadResourceToR2(resourceId, file, topic.id);
      }
      
      if (!resource) {
        const dataUrl = await fileToBase64(file);
        resource = { id: createId(), topicId: topic.id, name: file.name, type: file.type, size: file.size, data: dataUrl, addedAt: new Date().toISOString() };
        if (isOnline && api.isSignedIn()) {
          resource = await createResourceAPI({ ...resource, data: dataUrl });
        }
      }
      
      if (resource) {
        const list = resourcesByTopic.get(topic.id) || [];
        list.push(resource);
        resourcesByTopic.set(topic.id, list);
        await saveResources([resource]);
      }
    } catch (error) {
      showToast(`Failed to process ${file.name}: ${error.message}`, "error");
      return;
    }
  }
  
  if (tooLarge.length) {
    showToast("Some files were skipped because they are over 20 MB.", "warning");
  } else {
    showToast("Resource saved.", "success");
  }
  renderTopics();
}

// ============================================
// Sync Functions
// ============================================

async function syncPull() {
  if (!isOnline || !api.isSignedIn()) {
    showToast("Sync requires an internet connection and sign-in.", "error");
    return;
  }
  
  setButtonLoading(syncPullButton, true);
  syncNotice.textContent = "Pulling from cloud...";
  
  try {
    const data = await api.sync.pull();
    if (data.profile) {
      profile = data.profile;
      saveProfile();
      studentName.textContent = profile.name;
    }
    if (data.topics) {
      topics = data.topics;
      saveTopics();
    }
    if (data.attendanceSubjects) {
      attendanceSubjects = data.attendanceSubjects;
      saveAttendanceSubjects();
    }
    if (data.resources) {
      resourcesByTopic.clear();
      for (const resource of data.resources) {
        const list = resourcesByTopic.get(resource.topicId) || [];
        list.push(resource);
        resourcesByTopic.set(resource.topicId, list);
      }
      await saveResources(data.resources);
    }
    
    renderTopics();
    renderAttendance();
    showToast("Data pulled from cloud successfully.", "success");
    syncNotice.textContent = "";
  } catch (error) {
    showToast("Pull failed: " + error.message, "error");
    syncNotice.textContent = "Pull failed: " + error.message;
  } finally {
    setButtonLoading(syncPullButton, false);
    await loadSyncStatus();
  }
}

async function syncPush() {
  if (!isOnline || !api.isSignedIn()) {
    showToast("Sync requires an internet connection and sign-in.", "error");
    return;
  }
  
  setButtonLoading(syncPushButton, true);
  syncNotice.textContent = "Pushing to cloud...";
  
  try {
    const clientVersion = parseInt(localStorage.getItem("sv_clientVersion") || "0");
    const pushData = {
      profile,
      topics: topics.map(t => ({ ...t, _deleted: false })),
      attendanceSubjects: attendanceSubjects.map(s => ({ ...s, _deleted: false })),
      resources: Array.from(resourcesByTopic.values()).flat().map(r => ({ ...r, _deleted: false })),
      clientVersion
    };
    
    const data = await api.sync.push(pushData);
    
    if (data.conflicts && data.conflicts.length > 0) {
      showToast("Conflicts detected. Please resolve.", "warning");
      syncNotice.textContent = "Conflicts detected. Please resolve.";
      renderConflicts(data.conflicts);
    } else {
      localStorage.setItem("sv_clientVersion", data.serverVersion.toString());
      showToast("Data pushed to cloud successfully.", "success");
      syncNotice.textContent = "";
    }
  } catch (error) {
    showToast("Push failed: " + error.message, "error");
    syncNotice.textContent = "Push failed: " + error.message;
  } finally {
    setButtonLoading(syncPushButton, false);
    await loadSyncStatus();
  }
}

function renderConflicts(conflicts) {
  if (syncConflicts) syncConflicts.hidden = false;
  if (syncConflictsList) {
    syncConflictsList.innerHTML = "";
    for (const conflict of conflicts) {
      const item = document.createElement("div");
      item.className = "conflict-item";
      item.innerHTML = `
        <h4>${conflict.type}: ${conflict.id}</h4>
        <div class="conflict-diff">
          <div class="server"><strong>Server:</strong><br>${escapeHtml(JSON.stringify(conflict.serverData, null, 2))}</div>
          <div class="client"><strong>Local:</strong><br>${escapeHtml(JSON.stringify(conflict.clientData, null, 2))}</div>
        </div>
        <div class="conflict-actions">
          <button class="primary-button" data-action="use-server" data-conflict-id="${conflict.id}">Use Server</button>
          <button class="primary-button" data-action="use-client" data-conflict-id="${conflict.id}">Use Local</button>
        </div>
      `;
      syncConflictsList.appendChild(item);
    }
  }
}

// ============================================
// Backup/Import Functions
// ============================================

function exportBackup() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    topics,
    attendanceSubjects,
    resources: Array.from(resourcesByTopic.values()).flat()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `student-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported.", "success");
}

async function importBackup(file) {
  try {
    const text = await file.text();
    const backup = JSON.parse(text);
    
    if (!backup.version || backup.version !== 1) {
      showToast("Unsupported backup format.", "error");
      return;
    }
    
    if (backup.profile) {
      profile = backup.profile;
      saveProfile();
      studentName.textContent = profile.name;
    }
    if (backup.topics) {
      topics = backup.topics;
      saveTopics();
    }
    if (backup.attendanceSubjects) {
      attendanceSubjects = backup.attendanceSubjects;
      saveAttendanceSubjects();
    }
    if (backup.resources) {
      resourcesByTopic.clear();
      for (const resource of backup.resources) {
        const list = resourcesByTopic.get(resource.topicId) || [];
        list.push(resource);
        resourcesByTopic.set(resource.topicId, list);
      }
      await saveResources(backup.resources);
    }
    
    renderTopics();
    renderAttendance();
    showToast("Backup imported successfully.", "success");
  } catch (error) {
    showToast("Import failed: " + error.message, "error");
  }
}

// Initialize Application
syncPullButton.addEventListener("click", syncPull);
syncPushButton.addEventListener("click", syncPush);

// Backup/Import
exportButton.addEventListener("click", exportBackup);
importInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) { importBackup(file); event.target.value = ""; }
});

// Initialize Application
async function initialize() {
  await initIndexedDB();
  
  today.textContent = new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  
  // Initialize Clerk
  await initClerk();
  
  // Load initial data
  const loadedTopics = await loadTopicsFromAPI();
  if (!loadedTopics) {
    topics = loadTopics();
  }
  
  const loadedAttendance = await loadAttendanceFromAPI();
  if (!loadedAttendance) {
    attendanceSubjects = loadAttendanceSubjects();
  }
  
  profile = profile || loadProfile();
  studentName.textContent = profile?.name || currentUser?.firstName || currentUser?.username || "";
  
  // Load resources
  const loadedResources = await loadResourcesFromAPI();
  if (!loadedResources) {
    await loadResources();
  }
  
  // Load service statuses
  await Promise.all([
    loadYouTubeStatus(),
    loadSearchStatus(),
    loadAIStatus(),
    loadImagesStatus(),
    loadSyncStatus()
  ]);
  
  // Show initial view
  showView(location.hash === "#attendance" ? "attendance" : profile || currentUser ? "vault" : "welcome");
}

initialize();

export { showToast };