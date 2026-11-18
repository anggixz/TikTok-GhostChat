use std::net::{SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const SIDECAR_PORT: u16 = 21213;

#[derive(Default, Clone)]
struct SidecarProcess(Arc<Mutex<Option<Child>>>);

#[derive(Clone, Default)]
struct HotkeyConfig {
  click_through: String,
  ghost_mode: String,
  pin: String,
  settings: String,
}

struct HotkeyState {
  config: Mutex<HotkeyConfig>,
  thread_id: AtomicU32,
  click_through_active: AtomicBool,
}

#[cfg(target_os = "windows")]
const WM_HOTKEY: u32 = 0x0312;
#[cfg(target_os = "windows")]
const WM_USER: u32 = 0x0400;
#[cfg(target_os = "windows")]
const WM_UPDATE_HOTKEYS: u32 = WM_USER + 101;
#[cfg(target_os = "windows")]
const WM_QUIT_HOTKEYS: u32 = WM_USER + 102;

#[cfg(target_os = "windows")]
#[repr(C)]
struct MSG {
  hwnd: isize,
  message: u32,
  wparam: usize,
  lparam: isize,
  time: u32,
  pt_x: i32,
  pt_y: i32,
}

#[cfg(target_os = "windows")]
extern "system" {
  fn RegisterHotKey(hWnd: isize, id: i32, fsModifiers: u32, vk: u32) -> i32;
  fn UnregisterHotKey(hWnd: isize, id: i32) -> i32;
  fn GetMessageW(lpMsg: *mut MSG, hWnd: isize, wMsgFilterMin: u32, wMsgFilterMax: u32) -> i32;
  fn PostThreadMessageW(idThread: u32, Msg: u32, wParam: usize, lParam: isize) -> i32;
  fn GetCurrentThreadId() -> u32;
}

fn parse_keybind(s: &str) -> Option<(u32, u32)> {
  let parts: Vec<&str> = s.split('+').map(|p| p.trim()).collect();
  if parts.is_empty() { return None; }

  let mut modifiers = 0x4000u32; // MOD_NOREPEAT
  let mut vk = 0u32;

  for part in parts {
    let lower = part.to_lowercase();
    match lower.as_str() {
      "alt" => modifiers |= 0x0001,
      "ctrl" | "control" => modifiers |= 0x0002,
      "shift" => modifiers |= 0x0004,
      "win" | "meta" | "super" => modifiers |= 0x0008,
      _ => {
        if lower.starts_with('f') && lower.len() >= 2 {
          if let Ok(num) = lower[1..].parse::<u32>() {
            if (1..=24).contains(&num) {
              vk = 0x6F + num; // VK_F1 is 0x70
            }
          }
        } else if lower.len() == 1 {
          let ch = lower.chars().next().unwrap();
          if ch.is_ascii_alphabetic() {
            vk = ch.to_ascii_uppercase() as u32;
          } else if ch.is_ascii_digit() {
            vk = ch as u32;
          }
        } else {
          match lower.as_str() {
            "space" => vk = 0x20,
            "tab" => vk = 0x09,
            "esc" | "escape" => vk = 0x1B,
            "enter" | "return" => vk = 0x0D,
            _ => {}
          }
        }
      }
    }
  }

  if vk != 0 {
    Some((modifiers, vk))
  } else {
    None
  }
}

fn is_sidecar_listening() -> bool {
  let addr: SocketAddr = ([127, 0, 0, 1], SIDECAR_PORT).into();
  TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

fn find_sidecar_script(app_handle: &tauri::AppHandle) -> Option<PathBuf> {
  let mut candidates = Vec::new();

  if let Ok(cwd) = std::env::current_dir() {
    candidates.push(cwd.join("sidecar").join("server.js"));
  }

  if let Ok(exe_path) = std::env::current_exe() {
    if let Some(exe_dir) = exe_path.parent() {
      candidates.push(exe_dir.join("sidecar").join("server.js"));
      candidates.push(exe_dir.join("resources").join("sidecar").join("server.js"));
      if let Some(parent) = exe_dir.parent() {
        candidates.push(parent.join("sidecar").join("server.js"));
        candidates.push(parent.join("resources").join("sidecar").join("server.js"));
      }
      if let Some(grandparent) = exe_dir.parent().and_then(|p| p.parent()) {
        candidates.push(grandparent.join("sidecar").join("server.js"));
      }
    }
  }

  if let Ok(resource_path) = app_handle.path().resource_dir() {
    candidates.push(resource_path.join("sidecar").join("server.js"));
    candidates.push(resource_path.join("resources").join("sidecar").join("server.js"));
  }

  for path in candidates {
    if path.is_file() {
      return Some(path);
    }
  }

  None
}

fn start_sidecar(app_handle: &tauri::AppHandle, process_holder: &Arc<Mutex<Option<Child>>>) {
  if is_sidecar_listening() {
    println!("[TikZient] Sidecar WebSocket server is already listening on port {}", SIDECAR_PORT);
    return;
  }

  let Some(script_path) = find_sidecar_script(app_handle) else {
    eprintln!("[TikZient] sidecar/server.js not found in candidate paths.");
    return;
  };

  let working_dir = script_path.parent().unwrap_or(Path::new("."));
  println!("[TikZient] Auto-spawning sidecar engine from: {}", script_path.display());

  let mut cmd = Command::new("node");
  cmd.arg(&script_path);
  cmd.current_dir(working_dir);

  #[cfg(target_os = "windows")]
  cmd.creation_flags(CREATE_NO_WINDOW);

  match cmd.spawn() {
    Ok(child) => {
      *process_holder.lock().unwrap() = Some(child);
      println!("[TikZient] Sidecar process spawned successfully.");

      for _ in 0..30 {
        std::thread::sleep(Duration::from_millis(200));
        if is_sidecar_listening() {
          println!("[TikZient] Sidecar engine is ready and active on port {}", SIDECAR_PORT);
          break;
        }
      }
    }
    Err(err) => {
      eprintln!("[TikZient] Failed to auto-launch Node.js sidecar: {}. Ensure Node.js is installed.", err);
    }
  }
}

#[tauri::command]
fn set_global_hotkeys(
  state: tauri::State<Arc<HotkeyState>>,
  click_through_key: String,
  ghost_mode_key: String,
  pin_key: String,
  settings_key: String,
) -> Result<(), String> {
  let mut cfg = state.config.lock().unwrap();
  cfg.click_through = click_through_key;
  cfg.ghost_mode = ghost_mode_key;
  cfg.pin = pin_key;
  cfg.settings = settings_key;
  drop(cfg);

  #[cfg(target_os = "windows")]
  {
    let tid = state.thread_id.load(Ordering::SeqCst);
    if tid != 0 {
      unsafe {
        PostThreadMessageW(tid, WM_UPDATE_HOTKEYS, 0, 0);
      }
    }
  }

  Ok(())
}

fn start_hotkey_listener(app_handle: tauri::AppHandle, state: Arc<HotkeyState>) {
  #[cfg(target_os = "windows")]
  {
    std::thread::spawn(move || {
      let tid = unsafe { GetCurrentThreadId() };
      state.thread_id.store(tid, Ordering::SeqCst);

      let register_all = |cfg: &HotkeyConfig| {
        unsafe {
          for id in 1..=4 {
            UnregisterHotKey(0, id);
          }
          if let Some((mods, vk)) = parse_keybind(&cfg.click_through) {
            RegisterHotKey(0, 1, mods, vk);
          }
          if let Some((mods, vk)) = parse_keybind(&cfg.ghost_mode) {
            RegisterHotKey(0, 2, mods, vk);
          }
          if let Some((mods, vk)) = parse_keybind(&cfg.pin) {
            RegisterHotKey(0, 3, mods, vk);
          }
          if let Some((mods, vk)) = parse_keybind(&cfg.settings) {
            RegisterHotKey(0, 4, mods, vk);
          }
        }
      };

      // Initial registration
      {
        let cfg = state.config.lock().unwrap().clone();
        register_all(&cfg);
      }

      let mut msg = MSG {
        hwnd: 0,
        message: 0,
        wparam: 0,
        lparam: 0,
        time: 0,
        pt_x: 0,
        pt_y: 0,
      };

      loop {
        let ret = unsafe { GetMessageW(&mut msg, 0, 0, 0) };
        if ret <= 0 || msg.message == WM_QUIT_HOTKEYS {
          break;
        }

        if msg.message == WM_HOTKEY {
          let id = msg.wparam as i32;
          if let Some(win) = app_handle.get_webview_window("main") {
            match id {
              1 => {
                let cur = state.click_through_active.load(Ordering::SeqCst);
                let next = !cur;
                state.click_through_active.store(next, Ordering::SeqCst);
                let _ = win.set_ignore_cursor_events(next);
                let _ = win.emit("global-hotkey", "clickThrough");
              }
              2 => {
                let _ = win.emit("global-hotkey", "ghostMode");
              }
              3 => {
                let _ = win.emit("global-hotkey", "pin");
              }
              4 => {
                let _ = win.emit("global-hotkey", "settings");
              }
              _ => {}
            }
          }
        } else if msg.message == WM_UPDATE_HOTKEYS {
          let cfg = state.config.lock().unwrap().clone();
          register_all(&cfg);
        }
      }

      unsafe {
        for id in 1..=4 {
          UnregisterHotKey(0, id);
        }
      }
    });
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let sidecar_proc = SidecarProcess::default();
  let sidecar_holder = sidecar_proc.0.clone();
  let cleanup_holder = sidecar_proc.0.clone();

  let hotkey_state = Arc::new(HotkeyState {
    config: Mutex::new(HotkeyConfig {
      click_through: "Alt+G".into(),
      ghost_mode: "Alt+H".into(),
      pin: "Alt+P".into(),
      settings: "Alt+S".into(),
    }),
    thread_id: AtomicU32::new(0),
    click_through_active: AtomicBool::new(false),
  });

  let hotkey_state_listener = hotkey_state.clone();
  let hotkey_state_exit = hotkey_state.clone();

  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(hotkey_state)
    .invoke_handler(tauri::generate_handler![set_global_hotkeys])
    .setup(move |app| {
      start_sidecar(app.handle(), &sidecar_holder);
      start_hotkey_listener(app.handle().clone(), hotkey_state_listener);
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(move |_app_handle, event| {
      if let tauri::RunEvent::Exit = event {
        #[cfg(target_os = "windows")]
        {
          let tid = hotkey_state_exit.thread_id.load(Ordering::SeqCst);
          if tid != 0 {
            unsafe {
              PostThreadMessageW(tid, WM_QUIT_HOTKEYS, 0, 0);
            }
          }
        }

        if let Some(mut child) = cleanup_holder.lock().unwrap().take() {
          println!("[TikZient] Closing background sidecar engine...");
          let _ = child.kill();
        }
      }
    });
}
