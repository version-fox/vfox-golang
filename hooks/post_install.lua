function PLUGIN:PostInstall(ctx)
  local sdkInfo = ctx.sdkInfo["golang"]
  local path = sdkInfo.path

  if RUNTIME.osType == "windows" then
    os.execute("mkdir " .. path .. "\\packages\\bin")
  else
    os.execute("mkdir -p " .. path .. "/packages/bin")
  end
end
