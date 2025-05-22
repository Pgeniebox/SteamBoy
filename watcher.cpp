#include <windows.h>
#include <thread>
#include <atomic>
#include <string>
#include <napi.h>

Napi::ThreadSafeFunction tsfn;
std::thread watcherThread;
std::atomic<bool> watching = false;
HANDLE hDir = INVALID_HANDLE_VALUE;

void WatchFileThread(std::string dir, std::string targetFilename) {
    hDir = CreateFileA(
        dir.c_str(),
        FILE_LIST_DIRECTORY,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        NULL,
        OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS,
        NULL
    );

    if (hDir == INVALID_HANDLE_VALUE) return;

    watching = true;

    char buffer[1024];
    DWORD bytesReturned;

    while (watching) {
        if (ReadDirectoryChangesW(
                hDir,
                buffer,
                sizeof(buffer),
                FALSE,
                FILE_NOTIFY_CHANGE_LAST_WRITE,
                &bytesReturned,
                NULL,
                NULL
            )) {

            FILE_NOTIFY_INFORMATION* fni = (FILE_NOTIFY_INFORMATION*)buffer;

            do {
                int len = WideCharToMultiByte(CP_UTF8, 0, fni->FileName, fni->FileNameLength / sizeof(WCHAR), NULL, 0, NULL, NULL);
                std::string filename(len, 0);
                WideCharToMultiByte(CP_UTF8, 0, fni->FileName, fni->FileNameLength / sizeof(WCHAR), &filename[0], len, NULL, NULL);

                if (filename == targetFilename && tsfn) {
                    tsfn.BlockingCall([=](Napi::Env env, Napi::Function jsCallback) {
                        jsCallback.Call({ Napi::String::New(env, filename) });
                    });
                }

                fni = fni->NextEntryOffset ? (FILE_NOTIFY_INFORMATION*)((char*)fni + fni->NextEntryOffset) : nullptr;
            } while (fni);
        }

        Sleep(10);
    }

    if (hDir != INVALID_HANDLE_VALUE) {
        CloseHandle(hDir);
        hDir = INVALID_HANDLE_VALUE;
    }
}

Napi::Value StartWatching(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    std::string dir = info[0].As<Napi::String>();
    std::string filename = info[1].As<Napi::String>();
    Napi::Function cb = info[2].As<Napi::Function>();

    tsfn = Napi::ThreadSafeFunction::New(
        env,
        cb,
        "WatchCallback",
        0,
        1
    );

    watcherThread = std::thread([=]() {
        WatchFileThread(dir, filename);
    });

    return env.Undefined();
}

Napi::Value StopWatching(const Napi::CallbackInfo& info) {
    watching = false;

    std::thread([=]() {
        if (watcherThread.joinable()) {
            watcherThread.join();
        }
        if (tsfn) {
            tsfn.Release();
        }
    }).detach();

    return info.Env().Undefined();
}


Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("watchFile", Napi::Function::New(env, StartWatching));
    exports.Set("stopWatching", Napi::Function::New(env, StopWatching));
    return exports;
}

NODE_API_MODULE(watcher, Init)
