var themeSwitch = document.querySelector(".theme-selection");
  const dm_off = "fa-sun"
  const dm_on = "fa-moon"
  document.addEventListener('DOMContentLoaded', function () {

    const darkSwitch = document.getElementById("darkSwitch");
    const toggle = document.getElementById("darkSwitchToggle")
    function initTheme() {
      const e = null !== localStorage.getItem("darkSwitch") && "dark" === localStorage.getItem("darkSwitch");
      if (e) {
        toggle.classList.add(dm_on)
        themeSwitch.classList.add('dark');
      } else {
        toggle.classList.add(dm_off)
        themeSwitch.classList.remove('dark');
      }
    }
    function resetTheme() {
      if (toggle.classList.contains(dm_off)) {
        themeSwitch.classList.add('dark');
        localStorage.setItem("darkSwitch", "dark")
      } else {
        themeSwitch.classList.remove('dark');
        localStorage.removeItem("darkSwitch")
      }
      toggle.classList.toggle(dm_off)
      toggle.classList.toggle(dm_on)
    }

    window.addEventListener("load", () => {
      darkSwitch && (initTheme(), darkSwitch.addEventListener("click", () => {
        resetTheme()
      }))
    });
  })
