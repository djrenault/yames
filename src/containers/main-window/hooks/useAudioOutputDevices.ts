import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  listAudioOutputDevices,
  onAudioDevicesChanged,
  setAudioOutputDevice,
  storeLoad,
} from "../../../ipc";
import type { AudioOutputDevice } from "../../../types";

/**
 * Owns the audio-output device list and the user's currently-selected
 * device. On mount, hydrates both from the OS + the persisted store; while
 * mounted, listens for hot-plug / removal events and keeps the list fresh.
 *
 * When the currently-selected device disappears (e.g. user unplugs USB
 * audio while the app is running), the selection clears and the backend is
 * told to fall back to the system default — this avoids a silent metronome
 * on a stale device handle.
 *
 * The save side of the selection is handled by `DevicesSettingsSection`
 * (which calls `setAudioOutputDevice` directly when the user picks a new
 * one), so this hook stays read-on-mount + listen.
 */

export interface AudioOutputDevicesState {
  audioOutputDevices: AudioOutputDevice[];
  setAudioOutputDevices: Dispatch<SetStateAction<AudioOutputDevice[]>>;
  selectedOutputDevice: string;
  setSelectedOutputDevice: Dispatch<SetStateAction<string>>;
  /** 0-indexed output channel, or -1 for "all channels" (the default). */
  selectedOutputChannel: number;
  setSelectedOutputChannel: Dispatch<SetStateAction<number>>;
}

export function useAudioOutputDevices(): AudioOutputDevicesState {
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    AudioOutputDevice[]
  >([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>("");
  const [selectedOutputChannel, setSelectedOutputChannel] = useState<number>(-1);

  // Mount: hydrate device list + persisted selection.
  useEffect(() => {
    (async () => {
      const devices = await listAudioOutputDevices();
      setAudioOutputDevices(devices);
      const savedDevice = await storeLoad<string>("audioOutputDevice");
      if (savedDevice) setSelectedOutputDevice(savedDevice);
      const savedChannel = await storeLoad<number>("audioOutputChannel");
      if (typeof savedChannel === "number") setSelectedOutputChannel(savedChannel);
    })();
  }, []);

  // Listen for device hot-plug / removal. If the selected device vanishes,
  // clear the selection and reset the backend to the system default so the
  // user doesn't end up routing to a stale handle.
  useEffect(() => {
    const unlisten = onAudioDevicesChanged((devices) => {
      setAudioOutputDevices(devices);
      if (
        selectedOutputDevice &&
        !devices.some((d) => d.name === selectedOutputDevice)
      ) {
        setSelectedOutputDevice("");
        setAudioOutputDevice(null);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [selectedOutputDevice]);

  return {
    audioOutputDevices,
    setAudioOutputDevices,
    selectedOutputDevice,
    setSelectedOutputDevice,
    selectedOutputChannel,
    setSelectedOutputChannel,
  };
}
