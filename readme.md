SMTP Extractor v1.0: Quick Guide
===============================
1. Install Dependencies:

Make sure you have Node.js installed.
Navigate to the project directory.
Run npm install to install the required packages.

2. Select a Dork:
The software presents predefined search queries (potential dorks) to find vulnerable servers containing sensitive SMTP information.
You can either choose from the provided options or enter your own custom dork.

3. Bypass reCaptcha service:
The tool uses a module to automate Google searches and handle reCaptcha challenges.

4. Extract URLs:
The tool collects all URLs from the search results that may contain sensitive information
It intelligently navigates through pages to gather as many URLs as possible.

5. Process SMTP Information:
Each collected URL is checked
If valid SMTP credentials are found, they are extracted and saved to a text file (smtp_extracted.txt).

6. Results and Completion:
Once all URLs are processed, the software saves the valid SMTP credentials and notifies you of the completion.


