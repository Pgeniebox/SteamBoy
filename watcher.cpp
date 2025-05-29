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
    std::string fullPath = dir + "\\" + targetFilename;
    bool fileExists = (GetFileAttributesA(fullPath.c_str()) != INVALID_FILE_ATTRIBUTES);
    DWORD notifyFilter = FILE_NOTIFY_CHANGE_FILE_NAME | FILE_NOTIFY_CHANGE_LAST_WRITE;

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
    char buffer[2048];
    DWORD bytesReturned;

    while (watching) {
        if (ReadDirectoryChangesW(
                hDir,
                buffer,
                sizeof(buffer),
                FALSE,
                notifyFilter,
                &bytesReturned,
                NULL,
                NULL
            )) {

            FILE_NOTIFY_INFORMATION* fni = (FILE_NOTIFY_INFORMATION*)buffer;

            do {
                int len = WideCharToMultiByte(CP_UTF8, 0, fni->FileName, fni->FileNameLength / sizeof(WCHAR), NULL, 0, NULL, NULL);
                std::string filename(len, 0);
                WideCharToMultiByte(CP_UTF8, 0, fni->FileName, fni->FileNameLength / sizeof(WCHAR), &filename[0], len, NULL, NULL);

                if (filename == targetFilename && watching && tsfn) {
                    std::string eventType;
                    std::string fileContent;

                    if (fni->Action == FILE_ACTION_ADDED || fni->Action == FILE_ACTION_RENAMED_NEW_NAME) {
                        eventType = "created";
                        fileExists = true;
                    } else if (fni->Action == FILE_ACTION_MODIFIED) {
                        eventType = "modified";
                    }

                    if (!eventType.empty()) {
                        int attempts = 3;
                        while (attempts-- > 0 && fileContent.empty()) {
                            HANDLE fileHandle = CreateFileA(
                                fullPath.c_str(),
                                GENERIC_READ,
                                FILE_SHARE_READ | FILE_SHARE_WRITE,
                                NULL,
                                OPEN_EXISTING,
                                FILE_ATTRIBUTE_NORMAL,
                                NULL
                            );

                            if (fileHandle != INVALID_HANDLE_VALUE) {
                                DWORD fileSize = GetFileSize(fileHandle, NULL);
                                if (fileSize != INVALID_FILE_SIZE && fileSize > 0) {
                                    std::string buffer(fileSize, '\0');
                                    DWORD bytesRead;
                                    if (ReadFile(fileHandle, &buffer[0], fileSize, &bytesRead, NULL)) {
                                        fileContent = buffer;
                                    }
                                }
                                CloseHandle(fileHandle);
                                break;
                            }

                            Sleep(50);
                        }

                        if (watching && tsfn) {
                            std::string eventTypeCopy = eventType;
                            std::string filenameCopy = filename;
                            std::string contentCopy = fileContent;

                            tsfn.BlockingCall([eventTypeCopy, filenameCopy, contentCopy](Napi::Env env, Napi::Function jsCallback) {
                                Napi::Object obj = Napi::Object::New(env);
                                obj.Set("event", Napi::String::New(env, eventTypeCopy));
                                obj.Set("filename", Napi::String::New(env, filenameCopy));
                                obj.Set("content", Napi::String::New(env, contentCopy));
                                jsCallback.Call({ obj });
                            });
                        }
                    }
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

    watcherThread = std::thread([dir, filename]() {
        WatchFileThread(dir, filename);
    });

    return env.Undefined();
}

Napi::Value StopWatching(const Napi::CallbackInfo& info) {
    if (!watching) {
        return info.Env().Undefined();
    }

    watching = false;

    if (hDir != INVALID_HANDLE_VALUE) {
        CancelIoEx(hDir, NULL);
    }

    if (watcherThread.joinable()) {
        watcherThread.join();
    }

    if (tsfn) {
        tsfn.Release();
        tsfn = nullptr;
    }

    return info.Env().Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("watchFile", Napi::Function::New(env, StartWatching));
    exports.Set("stopWatching", Napi::Function::New(env, StopWatching));
    return exports;
}

NODE_API_MODULE(watcher, Init)
