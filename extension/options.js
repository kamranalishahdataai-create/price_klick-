function setStatus(t){ document.getElementById("status").innerText = t || ""; }

function renderHosts(hosts){
  const ul = document.getElementById("hostList");
  ul.innerHTML = "";
  (hosts || []).forEach((h, i) => {
    const li = document.createElement("li");
    li.textContent = h + " ";
    const rm = document.createElement("button");
    rm.textContent = "Remove";
    rm.className = "btn";
    rm.addEventListener("click", async () => {
      const arr = (await chrome.storage.sync.get(["cf_hosts"]))?.cf_hosts || [];
      arr.splice(i, 1);
      await chrome.storage.sync.set({ cf_hosts: arr });
      renderHosts(arr);
    });
    li.appendChild(rm);
    ul.appendChild(li);
  });
}

document.getElementById("addHost").addEventListener("click", async () => {
  const v = document.getElementById("hostInput").value.trim();
  if (!v) return;
  const { cf_hosts } = await chrome.storage.sync.get(["cf_hosts"]);
  const arr = cf_hosts || [];
  if (!arr.includes(v)) arr.push(v);
  await chrome.storage.sync.set({ cf_hosts: arr });
  document.getElementById("hostInput").value = "";
  renderHosts(arr);
});

document.getElementById("save").addEventListener("click", async () => {
  const autoApply = document.getElementById("autoApply").checked;
  await chrome.storage.sync.set({ cf_autoApply: autoApply });
  setStatus("Saved ✔");
  setTimeout(()=> setStatus(""), 1500);
});

(async function init(){
  const { cf_hosts, cf_autoApply } = await chrome.storage.sync.get(["cf_hosts", "cf_autoApply"]);
  renderHosts(cf_hosts || []);
  document.getElementById("autoApply").checked = !!cf_autoApply;
})();
