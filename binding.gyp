{
  "targets": [
    {
      "target_name": "watcher",
      "sources": [ "watcher.cpp" ],
      "include_dirs": [
        "./node_modules/node-addon-api"
      ],
      "defines": [ "NAPI_CPP_EXCEPTIONS" ],
      "cflags_cc": [ "-std:c++17" ]
    }
  ]
}
