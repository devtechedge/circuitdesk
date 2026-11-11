import QRCode from "qrcode";

export async function renderRegistrationQrSvg(params: {
  baseUrl: string;
  brandSlug: string;
  serialNumber: string;
  sku: string;
  size?: number;
}): Promise<{ targetUrl: string; svgMarkup: string }> {
  const cleanBase = params.baseUrl.replace(/\/$/, "");
  const targetUrl = `${cleanBase}/w/${encodeURIComponent(
    params.brandSlug
  )}/register?serial=${encodeURIComponent(params.serialNumber)}&sku=${encodeURIComponent(
    params.sku
  )}&source=qr`;

  const svgMarkup = await QRCode.toString(targetUrl, {
    type: "svg",
    margin: 1,
    width: params.size ?? 136,
    color: {
      dark: "#0f172a",
      light: "#ffffff",
    },
  });

  return { targetUrl, svgMarkup };
}
