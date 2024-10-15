"use strict";

import {stringify} from 'csv-stringify/browser/esm';

((ctx) => {
  function init(context) {

    // IDB

    async function idb(fn) {
      const request = fn.call(context);
      const promise = new Promise((resolve, reject) => {
        request.onerror = (ev) => { reject(ev) };
        request.onsuccess = (ev) => { resolve(request.result) };
      });

      return await promise;
    }

    async function updateActivity(activity, updates) {
      const item = Object.assign(activity, updates);

      const [activities, transaction] = await activitiesStore('readwrite');
      const update = idb(() => activities.put(item));

      // transaction.commit();

      return await update;
    }

    async function queryIsActive(userId) {
      const swatchId = currentSwatchId();
      const index = await activitiesIndex("singleActiveUserIndex");
      const activity = await idb(() => index.get([swatchId, userId, -1]));

      return activity && activity.__id__ == userId;
    }

    function activitiesStore(mode = "readonly") { return getStore("activities", mode) };
    function swatchesStore(mode = "readonly") { return getStore("swatches", mode) };

    async function activitiesIndex(name, ...rest) {
      const [store, t] = await activitiesStore.apply(this, rest);
      return store.index(name);
    }

    async function queryActivities(query) {
      let activities, key;
      switch (typeof query) {
      case "string":
        activities = await activitiesIndex("swatchIndex");
        key = query;
        break;
      case "object":
        const index = Object.keys(query)[0];
        activities = await activitiesIndex(index);
        key = query[index];
        break;
      default:
        throw("Doh!");
      }
      const getAll = idb(() => activities.getAll(__swatchId__));

      return await getAll;
    }

    async function countOngoingActivities(__swatchId__) {
      const ongoingActivities = await activitiesIndex("allActiveIndex");
      const count = idb(() => ongoingActivities.count([__swatchId__, -1]));

      return await count;
    }

    async function queryOngoingActivities(__swatchId__) {
      const ongoingActivities = await activitiesIndex("allActiveIndex");
      const getAll = idb(() => ongoingActivities.getAll([__swatchId__, -1]));

      return await getAll;
    }

    async function getStore(name, mode = "readonly") {
      const db = await dbReady
      const transaction = db.transaction(name, mode);

      return [transaction.objectStore(name), transaction];
    }

    async function getSwatches() {
      const [swatches, t] = await swatchesStore();
      const getAll = idb(() => swatches.getAll());

      return await getAll;
    }

    async function getSwatch(id) {
      if (currentSwatchId() == id) return currentSwatch();

      const [swatches, t] = await swatchesStore();
      const get = idb(() => swatches.get(id));

      return await get;
    }

    // GENERIC

    function sortByName(a, b) { return a.name.localeCompare(b.name) }
    function sortByStartedAt(a, b) { return a.startedAt - b.startedAt }

    document.addEventListener('pageOpened', ev => {
      const page = ev.detail.target.id;
      const url = new URL(location);

      console.log(page);

      switch (page) {
        case 'banner':
          startBannerWatch();
          stopSwatchWatches();
          break;
        case 'swatch':
          url.path = `/swatch/${currentSwatchId()}`;
          history.pushState({ page, swatchId: currentSwatchId() }, '', url);

          stopBannerWatch();
          startSwatchWatches();

          break;
        default:
          url.path = `/${page}`
          history.pushState({ page, swatchId: currentSwatchId() }, '', url);

          stopSwatchWatches();
          stopBannerWatch();
      }
    });
    addEventListener('popstate', ev => {
      const { page, swatchId } = ev.state;

      console.log(ev.state);

      switch (page) {
      case 'swatch': openSwatch(swatchId);
        break;
      case 'finalize': openSwatch(swatchId);
        break;
      case 'delete': openSwatch(swatchId);
        break;
      case 'swatchList': openSwatchList();
        break;
      case 'newSwatch': openForm();
        break;
      default:
        if (swatchId) openSwatch(swatchId);
        else openSwatchList()
      }
    });

    function openPage(id, title = "Swatch") {
      headerSwatchName.innerText = title;

      document.querySelector(".page.open").classList.remove("open");
      const target = document.getElementById(id);
      target.classList.add("open");

      context.currentPage = id;

      const pageOpened = new CustomEvent("pageOpened", { detail: { target }});
      document.dispatchEvent(pageOpened);
    }

    function currentSwatch() { return pageSwatch.data }
    function currentSwatchId() { if (pageSwatch.data) return pageSwatch.data.__id__ }
    function setCurrentSwatch(newSwatch) {
      if (currentSwatchId() == newSwatch.__id__) return;

      const detail = { newSwatch, oldSwatch: pageSwatch.data }
      const swatchChanged = new CustomEvent("swatchChanged", { detail });

      localStorage.setItem("swatchId", newSwatch.__id__);
      pageSwatch.data = newSwatch;

      document.dispatchEvent(swatchChanged);
    }
    function resetCurrentSwatch() {
      if (currentSwatchId() == undefined) return;

      const detail = { newSwatch: null, oldSwatch: pageSwatch.data }
      const swatchChanged = new CustomEvent("swatchChanged", { detail });

      localStorage.removeItem("swatchId");
      pageSwatch.data = null;

      document.dispatchEvent(swatchChanged);
    }

    let usersById = {};
    let tasksById = {};
    document.addEventListener("swatchChanged", ev => {
      const swatch = ev.detail.newSwatch;

      usersById = {};
      tasksById = {};

      if (swatch != null) {
        swatch.users.sort(sortByName);
        swatch.users.forEach(user => { usersById[user.__id__] = user });
        swatch.tasks.sort(sortByStartedAt);
        swatch.tasks.forEach(task => { tasksById[task.__id__] = task });
      }
    });

    // MENU

    const headerSwatchName = document.getElementById("title");
    const pageMenu = document.getElementById("menu");
    const buttonExport = pageMenu.querySelector("button[name=export]");
    const buttonDelete = pageMenu.querySelector("button[name=delete]");
    const buttonOpen = pageMenu.querySelector("button[name=open]");
    const menuSpecific = pageMenu.querySelector("#specificOptions");
    const menuGeneric = pageMenu.querySelector("#genericOptions");

    async function openMenu() {
      const swatch = currentSwatch();

      if (swatch) {
        const ongoingActivitiesCount = await countOngoingActivities(swatch.__id__);
        buttonExport.disabled = ongoingActivitiesCount > 0;
        menuSpecific.classList.remove("hidden");
      } else {
        menuSpecific.classList.add("hidden");
      }

      requestAnimationFrame(() => openPage("menu", swatch.name));
    }
    headerSwatchName.addEventListener("click", ev => {
      context.currentPage == "menu" ? history.go(-1) : openMenu();
    });

    menuGeneric.addEventListener("click", ev => {
      const el = ev.target;
      if (el.nodeName != "BUTTON") return;

      ev.preventDefault();
      switch (el.name) {
      case "new":
        openForm();
        break;
      case "open":
        openSwatchList();
        break;
      default:
      }
    });
    menuSpecific.addEventListener("click", ev => {
      const el = ev.target;
      if (el.nodeName != "BUTTON") return;

      ev.preventDefault();

      switch (el.name) {
      case "export": exportCSV();
        break;
      case "delete": openDelete();
        break;
      default:
        openSwatch(currentSwatchId());
      }
    });

    async function exportCSV() {
      const swatch = currentSwatch();
      const activities = await queryActivities(swatch.__id__);
      activities.sort(sortByStartedAt);

      const rows = [];
      const options = {
        header: true,
        columns: ['Benutzer', 'Datum', 'Tätigkeit', 'Zeit']
      };
      const stringifier = stringify(options);
      stringifier.on('readable', () => {
        let row;
        while ((row = stringifier.read()) !== null) { rows.push(row) }
      });
      stringifier.on('finish', () => {
        const csv = rows.join('');
        const data = new Blob([csv], { type: 'text/csv' });

        const anchor = document.createElement("A");
        anchor.href = URL.createObjectURL(data);
        anchor.download = `${swatch.name}.csv`;
        anchor.click();

        openSwatch(currentSwatchId());
      });

      const formatter = new Intl.DateTimeFormat("de");
      activities.forEach(activity => {
        const date = formatter.format(activity.stoppedAt);
        const dTs = (activity.stoppedAt - activity.startedAt.getTime()) / 1000;
        const userName = usersById[activity.__userId__].name;
        const taskName = tasksById[activity.__taskId__].name;

        const data = [userName, date, taskName, Math.floor(dTs)];
        stringifier.write(data);
      });
      stringifier.end();
    }

    function createMenuItem(swatch) {
      const anchor = document.createElement('A');
      anchor.innerText = swatch.name;
      anchor.data = swatch;
      if (currentSwatchId() == swatch.__id__) anchor.classList.add('current');

      const item = document.createElement('LI');
      item.append(anchor);

      return item;
    }

    // DELETE

    const pageDelete = document.getElementById('delete');

    function openDelete() {
      requestAnimationFrame(() => openPage('delete'));
    }

    async function deleteSwatch() {
      const swatchId = currentSwatchId();
      resetCurrentSwatch();

      const db = await dbReady;
      const promises = [];

      const transaction = db.transaction(["swatches", "activities"], "readwrite");
      const swatches = transaction.objectStore("swatches");
      const activities = transaction.objectStore("activities");

      const keys = await idb(() => activities.index("swatchIndex").getAllKeys(swatchId));
      keys.forEach(key => {
        const deleteActivity = idb(() => activities.delete(key));
        promises.push(deleteActivity);
      });
      const deleteSwatch = idb(() => swatches.delete(swatchId));
      promises.push(deleteSwatch);

      const deleteAll = Promise.all(promises).then(values => openListOrForm());
      transaction.commit();

      return await deleteAll;
    }

    pageDelete.addEventListener('click', ev => {
      const el = ev.target;
      if (el.nodeName != "BUTTON") return;

      ev.preventDefault();

      if (el.name == "back") openSwatch(currentSwatchId());
      else deleteSwatch();
    });

    // SWATCHES

    const listSwatches = document.getElementById('swatches');

    async function openSwatchList() {
      openBanner();

      listSwatches.innerHTML = '';

      const swatches = await getSwatches();
      swatches.sort(sortByName);
      swatches.forEach(swatch => {
        const item = createMenuItem(swatch);
        listSwatches.append(item);
      });

      requestAnimationFrame(() => openPage('swatchList'));
    }
    listSwatches.addEventListener('click', ev => {
      const el = ev.target;
      if (el.nodeName != "A") return;

      ev.preventDefault();

      openSwatch(el.data.__id__);
    });

    document.addEventListener("swatchChanged", ev => { redrawTasks() });

    // BANNER

    const watch = document.querySelector("#bannerWatch");

    function startBannerWatch() {
      if (context.intervalBannerWatch) return;

      context.intervalBannerWatch = setInterval(() => requestAnimationFrame(animateClock), 100);
      setTimeout(() => { if (context.currentPage == "banner") watch.classList.add("ok") }, 200);
    }

    function stopBannerWatch() {
      if (!context.intervalBannerWatch) return;

      watch.classList.remove("ok");
      clearInterval(context.intervalBannerWatch);

      delete context.intervalBannerWatch;
    }

    function openBanner() { requestAnimationFrame(()=> { openPage("banner") }) }

    const secondsElement = document.getElementById("second_hand");
    function animateClock() {
      const date = new Date();
      const second = date.getSeconds() + date.getMilliseconds() / 1000;

      secondsElement.setAttribute('transform', `rotate(${(360 / 60) * second})`);
    }

    // FINALIZE

    const pageFinalize = document.querySelector('#finalize');

    function openFinalize(activity) {
      const user = usersById[activity.__userId__];
      pageFinalize.data = activity;

      requestAnimationFrame(()=> { openPage('finalize', user.name) });
    }

    async function stopActivity(activity, task) {
      const updates = { stoppedAt: new Date(), __taskId__: task.__id__ };
      return await updateActivity(activity, updates);
    }

    pageFinalize.addEventListener("click", async ev => {
      const el = ev.target;
      if (el.nodeName != "BUTTON") return;

      ev.preventDefault();

      openBanner();
      if (el.name != "back") await stopActivity(pageFinalize.data, el.data);
      openSwatch(currentSwatchId());
    });

    function createTaskButton(task) {
      const btn = document.createElement("BUTTON");

      btn.value = task.__id__;
      btn.name = "taskId";
      btn.innerText = task.name;
      btn.data = task;

      return btn;
    }

    const buttonFinalizeBack = pageFinalize.querySelector('button[name=back]');
    function redrawTasks() {
      if (currentSwatch() == null) return;

      const tasks = currentSwatch().tasks
      tasks.sort(sortByName);

      tasks.forEach(task => {
        const btn = createTaskButton(task);
        buttonFinalizeBack.before(btn);
      });
    }

    // SWATCH

    const pageSwatch = document.getElementById("swatch");
    const listSwatchUsers = document.getElementById("swatchUsers");
    const listActiveSwatchUsers = document.getElementById("swatchActiveUsers");

    function updateWatches() {
      const timers = listActiveSwatchUsers.querySelectorAll(".timer");
      const now = new Date().getTime();
      const formatter = new Intl.DurationFormat("de", { style: "digital" });

      timers.forEach(timer => {
        const dT = (now - timer.data.startedAt.getTime()) / 1000;
        const seconds = Math.floor(dT % 60);
        const dTm = Math.floor(dT / 60);
        const minutes = Math.floor(dTm % 60);
        const hours = Math.floor(dTm / 60);

        timer.innerText = formatter.format({ hours, minutes, seconds});
      });
    }

    function startSwatchWatches() {
      if (context.intervalSwatchWatches) return;

      context.intervalSwatchWatches = setInterval(() => requestAnimationFrame(updateWatches), 100);
    }

    function stopSwatchWatches() {
      if (!context.intervalSwatchWatches) return;

      clearInterval(context.intervalSwatchWatches);

      delete context.intervalSwatchWatches;
    }

    function createUserListItem(user) {
      const timer = document.createElement("SPAN");
      timer.classList.add("timer");

      const anchor = document.createElement("A");
      anchor.data = user;
      anchor.innerText = user.name;
      anchor.append(timer);

      const item = document.createElement("LI");
      item.appendChild(anchor);

      return item;
    }

    async function openSwatch(swatchId) {
      openBanner();

      const swatch = await getSwatch(swatchId);
      if (swatch == undefined) {
        currentSwatch() ? openSwatch(currentSwatchId()) : openSwatchList();
        return;
      }

      setCurrentSwatch(swatch);

      const activities = await queryOngoingActivities(swatch.__id__);
      const activitiesByUserId = {};
      activities.sort(sortByStartedAt);
      activities.forEach(activity => { activitiesByUserId[activity.__userId__] = activity });

      const users = swatch.users;
      const activeUsers = [];
      users.forEach(user => {
        if (activitiesByUserId[user.__id__] != undefined) activeUsers.push(user);
      });

      const userListItemsByUserId = {};

      listSwatchUsers.innerHTML = "";
      users.forEach(user => {
        const item = createUserListItem(user);
        userListItemsByUserId[user.__id__] = item;
        listSwatchUsers.append(item);
      });

      listActiveSwatchUsers.innerHTML = "";
      activeUsers.forEach(user => {
        const item = userListItemsByUserId[user.__id__].cloneNode(true);
        item.querySelector(".timer").data = activitiesByUserId[user.__id__];
        listActiveSwatchUsers.append(item);
      });

      requestAnimationFrame(() => { openPage("swatch", swatch.name) });
    }

    listSwatchUsers.addEventListener("click", async (ev) => {
      const el = ev.target;
      if (el.nodeName != "A") return;

      ev.preventDefault();

      const user = el.data;
      const isActive = await queryIsActive(user.__id__);
      if (isActive) return;

      const item = el.parentNode.cloneNode(true);
      const timer = item.querySelector(".timer");

      const swatch = currentSwatch();
      const startedAt = new Date();
      const activity = { startedAt, stoppedAt: -1, __swatchId__: swatch.__id__, __userId__: user.__id__ };
      timer.data = activity;

      const [activities, t] = await activitiesStore("readwrite");
      activities.add(activity);

      requestAnimationFrame(() => { listActiveSwatchUsers.append(item) });
    });

    listActiveSwatchUsers.addEventListener('click', async (ev) => {
      const anchor = ev.target.closest('li a');
      if (anchor === null) return;

      ev.preventDefault();

      const activity = anchor.querySelector('.timer').data;
      currentSwatch().tasks.length ? openFinalize(activity) : stopActivity(activity, {});
    });

    // FORM

    function openForm() {
      requestAnimationFrame(()=> {
        openPage("newSwatch");
        textSwatchName.focus();
      });
    }

    const formNewSwatch = document.querySelector("#newSwatch form");
    const submitSwatch = document.querySelector("#newSwatch input[type=submit]");
    const textSwatchName = document.querySelector("#newSwatch input[name='swatch.name']");
    const textSwatchTaskName = document.querySelector("#newSwatch input[name='swatch.tasks[].name']");
    const buttonSwatchTaskAdd = document.querySelector("#newSwatch input[name='Task.add()']");
    const textSwatchUserName = document.querySelector("#newSwatch input[name='swatch.users[].name']");
    const buttonSwatchUserAdd = document.querySelector("#newSwatch input[name='User.add()']");

    formNewSwatch.addEventListener('submit', async (ev) => {
      ev.preventDefault();

      // TODO reset form

      if (submitSwatch.disabled) return;

      let tasks = [];
      const addedTaskNodes = textSwatchTaskName.parentNode.querySelectorAll(".added");
      addedTaskNodes.forEach(node => {
        tasks.push({ __id__: self.crypto.randomUUID(), name: node.value });
      });

      let users = [];
      const addedUserNodes = textSwatchUserName.parentNode.querySelectorAll(".added");
      addedUserNodes.forEach(node => {
        users.push({ __id__: self.crypto.randomUUID(), name: node.value });
      });

      const [swatches, t] = await swatchesStore("readwrite");

      const __id__ = self.crypto.randomUUID();
      const swatch = { __id__, name: textSwatchName.value, tasks, users }

      idb(() => swatches.add(swatch)).then(ev => { openSwatch(__id__) });
    });

    function submitForm() {
      const submit = new SubmitEvent("submit");
      formNewSwatch.dispatchEvent(submit);
    }

    function addTask() {
      if (buttonSwatchTaskAdd.disabled) return;

      const clone = textSwatchTaskName.cloneNode();
      clone.classList.add("added");
      textSwatchTaskName.value = "";
      buttonSwatchTaskAdd.disabled = true
      textSwatchTaskName.before(clone);
    }

    function addUser() {
      if (buttonSwatchUserAdd.disabled) return;

      const clone = textSwatchUserName.cloneNode();
      clone.classList.add("added");
      textSwatchUserName.value = "";
      buttonSwatchUserAdd.disabled = true
      textSwatchUserName.before(clone);
    }

    textSwatchName.addEventListener('input', ev => {
      submitSwatch.disabled = !textSwatchName.value.length;
    });
    textSwatchTaskName.addEventListener('input', ev => {
      buttonSwatchTaskAdd.disabled = !textSwatchTaskName.value.length;
    });
    textSwatchUserName.addEventListener('input', ev => {
      buttonSwatchUserAdd.disabled = !textSwatchUserName.value.length;
    });

    textSwatchName.addEventListener('keypress', ev => {
      if (ev.code != "Enter") return;

      ev.preventDefault();
      ev.stopImmediatePropagation();

      if (ev.ctrlKey) {
        submitForm();
      } else {
        textSwatchTaskName.focus();
      }
    });

    buttonSwatchTaskAdd.addEventListener('click', ev => { addTask() });
    textSwatchTaskName.addEventListener('keypress', ev => {
      if (ev.code != "Enter") return;

      ev.preventDefault();
      ev.stopImmediatePropagation();

      if (buttonSwatchTaskAdd.disabled) {
        textSwatchUserName.focus();
        return;
      }

      addTask();

      if (ev.ctrlKey) submitForm();
    });
    buttonSwatchUserAdd.addEventListener('click', ev => { addUser() });
    textSwatchUserName.addEventListener('keypress', ev => {
      if (ev.code != "Enter") return;

      ev.preventDefault();
      ev.stopImmediatePropagation();

      if (buttonSwatchUserAdd.disabled) {
        submitForm();
        return;
      }

      addUser();

      if (ev.ctrlKey) submitForm();
    });

    async function openListOrForm() {
      const [swatches, t] = await swatchesStore();
      const count = await idb(() => swatches.count());
      const req = swatches.count();

      count > 0 ? openSwatchList() : openForm();
    }

    let swatchId = localStorage.getItem("swatchId");
    if (swatchId) openSwatch(swatchId);
    else openListOrForm();
  }; // INIT END

  const canPersist = navigator.storage && navigator.storage.persist;
  if (!canPersist) {
    alert("Daten könnten beim Neuladen verloren gehen. Aktiviere die permanente Speicherung von Daten um das zu verhindern.");
  }

  const dbReady = new Promise((resolve, reject) => {
    const requestDatabase = window.indexedDB.open("swatch", 3);
    requestDatabase.onerror = (ev) => { reject(ev) };
    requestDatabase.onsuccess = (ev) => { resolve(requestDatabase.result) };
    requestDatabase.onupgradeneeded = (ev) => { migrate(requestDatabase.result) };
  });

  function migrate(db) {
    const locks = { activities: true, swatches: true };

    if (db.objectStoreNames.contains("swatches")) {
      delete locks.swatches;
    } else {
      const swatches = db.createObjectStore("swatches", { keyPath: "__id__" });
      swatches.createIndex("nameIndex", "name", { unique: true });
      swatches.transaction.oncomplete = () => {
        delete locks.swatches;
        if (Object.keys(locks).length === 0) dbReady.resolve(db)
      };
    }

    if (db.objectStoreNames.contains("activities")) {
      delete locks.activities;
    } else {
      const activities = db.createObjectStore("activities", { keyPath: ["__swatchId__", "__userId__", "startedAt"] });
      activities.createIndex("swatchIndex", "__swatchId__", { unique: false });
      activities.createIndex("allActiveIndex", ["__swatchId__", "stoppedAt"], { unique: false });
      activities.createIndex("singleActiveUserIndex", ["__swatchId__", "__userId__", "stoppedAt"], { unique: true });
      activities.transaction.oncomplete = () => {
        delete locks.activities;
        if (Object.keys(locks).length === 0) dbReady.resolve(db)
      };
    }
  }

  if (window.swatchContext === undefined) {
    window.swatchContext = {};
    document.addEventListener("DOMContentLoaded", () => init(window.swatchContext));
  }
})({});
