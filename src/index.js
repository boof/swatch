"use strict";

import {stringify} from 'csv-stringify/browser/esm';

((ctx) => {
  function init(context) {
    // MENU
    const headerSwatchName = document.getElementById("title");

    const pageMenu = document.getElementById("menu");
    const buttonBack = pageMenu.querySelector("button[name=back]");
    const buttonExport = pageMenu.querySelector("button[name=export]");
    const buttonDelete = pageMenu.querySelector("button[name=delete]");
    const buttonOpen = pageMenu.querySelector("button[name=open]");
    const menuSpecific = pageMenu.querySelector("#specificOptions");
    const menuGeneric = pageMenu.querySelector("#genericOptions");
    async function openMenu() {
      const swatch = currentSwatch();

      if (swatch) {
        const ongoingActivities = await queryOngoingActivities(swatch.__id__);
        buttonExport.disabled = ongoingActivities.length > 0;
        buttonBack.innerText = swatch.name;
        menuSpecific.classList.remove("hidden");
      } else {
        menuSpecific.classList.add("hidden");
      }

      requestAnimationFrame(() => openPage("menu"));
    }
    headerSwatchName.addEventListener("click", ev => openMenu());

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

      if (el.name == "export") exportCSV();
      openSwatch(currentSwatch().__id__);
    });

    const anchorDownload = document.getElementById('download');
    async function exportCSV() {
      const swatch = currentSwatch();
      const activities = await queryActivities(swatch.__id__);

      const userNamesById = {};
      swatch.users.forEach(user => { userNamesById[user.__id__] = user.name });
      const taskNamesById = {};
      swatch.tasks.forEach(task => { taskNamesById[task.__id__] = task.name });

      activities.sort((a, b) => { return b.startedAt - a.startedAt });

      const rows = [];
      const stringifier = stringify({ header: ['Benutzer', 'Datum', 'Tätigkeit', 'Zeit'] });
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
      })

      const formatter = new Intl.DateTimeFormat("de");
      activities.forEach(activity => {
        const date = formatter.format(activity.stoppedAt);
        const dTs = (activity.stoppedAt - activity.startedAt.getTime()) / 1000;
        const userName = userNamesById[activity.__userId__];
        const taskName = taskNamesById[activity.__taskId__];

        const data = [userName, date, taskName, Math.floor(dTs)];
        stringifier.write(data);
      });
      stringifier.end();
    }

    function createMenuItem(swatch) {
      const anchor = document.createElement('A');
      anchor.innerText = swatch.name;
      anchor.data = swatch;

      const item = document.createElement('LI');
      item.append(anchor);

      return item;
    }

    const listSwatches = document.getElementById('swatches');
    async function openSwatchList() {
      openBanner();

      listSwatches.innerHTML = '';

      const swatches = await getSwatches();
      swatches.sort((a, b) => { return a.name.localeCompare(b.name) });
      swatches.forEach(swatch => {
        const item = createMenuItem(swatch);
        listSwatches.append(item);
      });

      requestAnimationFrame(() => openPage('swatchList'));
    }

    document.addEventListener('pageOpened', ev => {
      console.log(ev.detail.target.id);

      switch (ev.detail.target.id) {
        case 'banner':
          startBannerWatch();
          stopSwatchWatches();
          break;
        case 'swatch':
          stopBannerWatch();
          startSwatchWatches();
          break;
        default:
          stopSwatchWatches();
          stopBannerWatch();
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

    function activitiesStore(mode = "readonly") { return getStore("activities", mode) };
    function swatchesStore(mode = "readonly") { return getStore("swatches", mode) };

    async function activitiesIndex(name) {
      const [store, t] = await activitiesStore();
      return store.index(name);
    }

    async function queryActivities(__swatchId__) {
      const activities = await activitiesIndex("swatchIndex");
      const promise = new Promise((resolve, reject) => {
        const req = activities.getAll(__swatchId__);

        req.onerror = (ev) => { reject(ev) };
        req.onsuccess = (ev) => { resolve(req.result) };
      });

      return await promise;
    }

    async function queryOngoingActivities(__swatchId__) {
      const ongoingActivities = await activitiesIndex("allActiveIndex");
      const promise = new Promise((resolve, reject) => {
        const req = ongoingActivities.getAll([__swatchId__, -1]);

        req.onerror = (ev) => { reject(ev) };
        req.onsuccess = (ev) => { resolve(req.result) };
      });

      return await promise;
    }

    function currentSwatch() { return pageSwatch.data }

    async function getSwatches() {
      const [swatches, t] = await swatchesStore();
      const promise = new Promise((resolve, reject) => {
        const req = swatches.getAll();

        req.onerror = (ev) => { reject(ev) };
        req.onsuccess = (ev) => { resolve(req.result) };
      });

      return await promise;
    }

    async function getSwatch(id) {
      if (currentSwatch() && currentSwatch().__id__ == id) return currentSwatch();

      const [swatches, t] = await swatchesStore();
      const promise = new Promise((resolve, reject) => {
        const req = swatches.get(id);

        req.onerror = (ev) => { reject(ev) };
        req.onsuccess = (ev) => { resolve(req.result) };
      });

      return await promise;
    }

    function setCurrentSwatch(newSwatch) {
      if (currentSwatch() && currentSwatch().__id__ == newSwatch.__id__) return;

      const detail = { newSwatch, oldSwatch: pageSwatch.data }
      const swatchChanged = new CustomEvent("swatchChanged", { detail });

      pageSwatch.data = newSwatch;

      document.dispatchEvent(swatchChanged);
    }
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

    function openBanner() {
      requestAnimationFrame(()=> { openPage("banner") });
    }

    const secondsElement = document.getElementById("second_hand");
    function animateClock() {
      const date = new Date();
      const second = date.getSeconds() + date.getMilliseconds() / 1000;

      secondsElement.setAttribute("transform", `rotate(${(360 / 60) * second})`);
    }

    // FINALIZE

    const pageFinalize = document.querySelector("#finalize");

    function createTaskButton(task) {
      const btn = document.createElement("BUTTON");

      btn.value = task.__id__;
      btn.name = "taskId";
      btn.innerText = task.name;
      btn.data = task;

      return btn;
    }

    function redrawTasks() {
      currentSwatch().tasks.forEach(task => {
        const btn = createTaskButton(task);
        pageFinalize.prepend(btn);
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
      const timer = document.createElement("span");
      timer.classList.add("timer");

      const anchor = document.createElement("a");
      anchor.data = user;
      anchor.innerText = user.name;
      anchor.append(timer);

      const item = document.createElement("li");
      item.appendChild(anchor);

      return item;
    }

    async function openSwatch(swatchId) {
      openBanner();

      const swatch = await getSwatch(swatchId);
      if (swatch == undefined) {
        currentSwatch() ? openSwatch(currentSwatch().__id__) : openSwatchList();
        return;
      }

      setCurrentSwatch(swatch);

      const activities = await queryOngoingActivities(swatch.__id__);
      const activitiesByUserId = {};
      activities.sort((a, b) => { return b.startedAt - a.startedAt });
      activities.forEach(activity => { activitiesByUserId[activity.__userId__] = activity });

      const users = swatch.users;
      const activeUsers = [];
      users.sort((a, b) => { return a.name.localeCompare(b.name) });
      users.forEach(user => {
        if (activitiesByUserId[user.__id__] != undefined) activeUsers.push(user);
      });

      const userListItemsByUser = {};

      listSwatchUsers.innerHTML = "";
      users.forEach(user => {
        const item = createUserListItem(user);
        userListItemsByUser[user] = item;
        listSwatchUsers.append(item);
      });

      listActiveSwatchUsers.innerHTML = "";
      activeUsers.forEach(user => {
        const item = userListItemsByUser[user].cloneNode(true);
        item.querySelector(".timer").data = activitiesByUserId[user.__id__];
        listActiveSwatchUsers.append(item);
      });

      localStorage.setItem("swatchId", swatchId);

      requestAnimationFrame(() => { openPage("swatch", swatch.name) });
    }

    async function queryIsActive(userId) {
      const swatchId = currentSwatch().__id__;
      const index = await activitiesIndex("singleActiveUserIndex");
      console.log([swatchId, userId, -1]);
      const promise = new Promise((resolve, r) => {
        const req = index.get([swatchId, userId, -1]);
        req.onerror = (ev) => { resolve(false) };
        req.onsuccess = (ev) => { resolve(req.result != undefined) };
      });

      return await promise;
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

    function openFinalize(data) {
      pageFinalize.data = data;
      requestAnimationFrame(()=> { openPage("finalize", "Tätigkeit") });
    }

    listActiveSwatchUsers.addEventListener("click", async (ev) => {
      const anchor = ev.target.closest("li a");
      if (anchor === null) return;

      ev.preventDefault();

      const activity = anchor.querySelector(".timer").data;
      pageSwatch.data.tasks.length ? openFinalize(activity) : stopActivity(activity, {});
    });

    async function stopActivity(activity, task) {
      const updates = { stoppedAt: new Date(), __taskId__: task.__id__ };
      const [activities, transaction] = await activitiesStore("readwrite");

      const request = new Promise((resolve, reject) => {
        const update = activities.put(Object.assign(activity, updates));
        update.onerror = (ev) => { reject(ev) };
        update.onsuccess = (ev) => { resolve(update.result) };
      });

      transaction.commit();
      await request;
    }

    pageFinalize.addEventListener("click", async ev => {
      const el = ev.target;
      if (el.nodeName != "BUTTON") return;

      ev.preventDefault();

      openBanner();
      if (el.name != "back") await stopActivity(pageFinalize.data, el.data);
      openSwatch(currentSwatch().__id__);
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

    formNewSwatch.addEventListener('submit', ev => {
      ev.preventDefault();

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

      dbReady.then(db => {
        const swatches = db
          .transaction("swatches", "readwrite")
          .objectStore("swatches");

        const __id__ = self.crypto.randomUUID();
        const requestAdd = swatches.add({
          __id__,
          name: textSwatchName.value,
          tasks,
          users,
          activities: []
        });

        requestAdd.onerror = (ev) => { console.log(ev) };
        requestAdd.onsuccess = (ev) => { openSwatch(__id__) };
      });
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

    let swatchId = localStorage.getItem("swatchId");
    swatchId ? openSwatch(swatchId) : openForm();
  };

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

  async function getStore(name, mode = "readonly") {
    const db = await dbReady
    const transaction = db.transaction(name, mode);

    return [transaction.objectStore(name), transaction];
  }

  // let swatches = [{
  //   __id__: UUID(),
  //   name: "Bürozeiten"
  //   tasks: [
  //     { __id__: UUID(), name: "Dokumentation" },
  //     { __id__: UUID(), name: "Allgemeine Büroarbeit" }
  //   ],
  //   user: [
  //     { __id__: UUID(), name: "LU" },
  //     { __id__: UUID(), name: "TIE" },
  //     { __id__: UUID(), name: "JT" },
  //     { __id__: UUID(), name: "MS" },
  //   ]
  // }, ...];
  // let activities = [{
  //   __swatchId__: swatches.__id__,
  //   __userId__: users.__id__,
  //   __taskId__: undefined | tasks.__id__
  //   startedAt: NOW(),
  //   stoppedAt: undefined | NOW()
  // }, ...];
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

