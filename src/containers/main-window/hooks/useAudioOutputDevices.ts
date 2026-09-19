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
  /** 0-indexed output channels; empty means "all channels" (the default). */
  selectedOutputChannels: number[];
  setSelectedOutputChannels: Dispatch<SetStateAction<number[]>>;
}

export function useAudioOutputDevices(): AudioOutputDevicesState {
  const [audioOutputDevices, setAudioOutputDevices] = useState<
    AudioOutputDevice[]
  >([]);
  const [selectedOutputDevice, setSelectedOutputDevice] = useState<string>("");
  const [selectedOutputChannels, setSelectedOutputChannels] = useState<number[]>([]);

  // Mount: hydrate device list + persisted selection.
  useEffect(() => {
    (async () => {
      const devices = await listAudioOutputDevices();
      setAudioOutputDevices(devices);
      const savedDevice = await storeLoad<string>("audioOutputDevice");
      if (savedDevice) setSelectedOutputDevice(savedDevice);
      // Prefer the multi-select array; fall back to the old single-channel
      // key so a selection saved before multi-select shipped isn't lost.
      const savedChannels = await storeLoad<number[]>("audioOutputChannels");
      if (Array.isArray(savedChannels)) {
        setSelectedOutputChannels(savedChannels);
      } else {
        const legacyChannel = await storeLoad<number>("audioOutputChannel");
        if (typeof legacyChannel === "number") setSelectedOutputChannels([legacyChannel]);
      }
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
    selectedOutputChannels,
    setSelectedOutputChannels,
  };
}
