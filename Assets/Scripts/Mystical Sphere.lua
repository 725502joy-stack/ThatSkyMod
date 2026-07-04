local function MysticalSphere()
    local mysticalSphere = game:mysticalSphereBarn():CreateMysticalSphere(getmetatable(MysticalSphereBarn))
    
    local transform = {
        {20, 0, 0, 0},
        {0, 20, 0, 0},
        {0, 0, 20, 0},
        {0, 1, 0, 1}
    }

    mysticalSphere:transform(transform)
    mysticalSphere:lightIntensityMult(1.0)
    mysticalSphere:avatarSpin(false)
    mysticalSphere:lockVisual(false)
    mysticalSphere:volumeInside(0.7)
    mysticalSphere:volumeOutside(0.2)
    mysticalSphere:camHintWhenOutRange(100.0)
    mysticalSphere:avatarNoFlight(false)
    mysticalSphere:avatarShout(false)
    mysticalSphere:isAirBubble(false)
    mysticalSphere:triggerOnExitOnDisable(false)
    mysticalSphere:forceEnterSound(true)
    mysticalSphere:hasRadarPoint(false)
    mysticalSphere:avatarAsSpiritMemory(false)
    mysticalSphere:setAmbiance(false)
    mysticalSphere:camHintWhenIn(true)
    mysticalSphere:playRepulsionSound(true)
    mysticalSphere:avatarCharge(true)
    mysticalSphere:setMusicVolume(true)
    mysticalSphere:sphereSparkles(true)
    mysticalSphere:volumeFadeTime(1.0)
end

MysticalSphere()
