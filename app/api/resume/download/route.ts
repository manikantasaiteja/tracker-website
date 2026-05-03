import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "No authorization header" },
        { status: 401 }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    // Get user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get resume info
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("resume_file_url, resume_file_name")
      .eq("id", user.id)
      .single();

    if (!profile?.resume_file_url) {
      return NextResponse.json(
        { error: "No resume found" },
        { status: 404 }
      );
    }

    // Extract file path from URL
    const filePath = profile.resume_file_url.split("/").slice(-2).join("/");

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return NextResponse.json(
        { error: "Failed to download file" },
        { status: 500 }
      );
    }

    // Convert blob to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Determine content type based on file extension
    const fileExt = profile.resume_file_name?.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    
    if (fileExt === "pdf") {
      contentType = "application/pdf";
    } else if (fileExt === "doc") {
      contentType = "application/msword";
    } else if (fileExt === "docx") {
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    // Return file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${profile.resume_file_name}"`,
      },
    });
  } catch (error) {
    console.error("Resume download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
