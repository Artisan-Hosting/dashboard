// src/lib/api.ts
import { BillingCosts, RefreshRequest, RefreshResponse, UsageSummary, VmActionRequest, VmActionType, VmListItem, VmStatusDetail } from "./types";
import { API_URL } from "./config";

export async function fetchWithAuth(endpoint: string) {
  const res = await fetch(
    `${API_URL}/${endpoint}`,
    {
      method: "GET",
      credentials: "include", // ← send the server‐issued cookie
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function postWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "POST",
    credentials: "include", // ← send the server‐issued cookie
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function putWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}

export async function deleteWithAuth(endpoint: string, body?: any) {
  const opts: RequestInit = {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(
    `${API_URL}/${endpoint}`,
    opts
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  return res.json();
}


export async function fetchBilling(
  usage: UsageSummary
): Promise<BillingCosts> {
  const res = await fetch(
    `${API_URL}/proxy/billing/calculate?instances=${usage.instances}`,
    {
      method: "POST",
      credentials: "include", // ← send the cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(usage),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error: ${res.status} ${text}`);
  }

  const resp = await res.json();
  if (resp.errors?.length) {
    throw new Error(resp.errors.map((e: any) => e.message).join("; "));
  }

  return resp.data as BillingCosts;
}

export async function sendVmAction(
  vmid: number,
  action: VmActionType,
): Promise<void> {
  const res = await fetchWithAuth(`proxy/vms/${vmid}/${action}`);
  if (res.status !== 'ok') {
    throw new Error(res.errors.join(', '));
  }
}

export async function fetchVmStatus(vmid: number): Promise<VmStatusDetail> {
  const res = await fetchWithAuth(`proxy/vms/${vmid}/status`);
  if (res.status !== 'ok' || !res.data) {
    throw new Error(res.errors.join(', '));
  }
  return res.data;
}

export async function fetchVmList(): Promise<VmListItem[]> {
  const res = await fetchWithAuth('proxy/vms');
  if (res.status !== 'ok' || !res.data) {
    throw new Error(res.errors.join(', '));
  }
  return res.data;
}