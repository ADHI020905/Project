package ai.bugdetect.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(properties = "spring.datasource.url=jdbc:h2:mem:bugdetect-test;DB_CLOSE_DELAY=-1")
@AutoConfigureMockMvc
class ApplicationFlowTest {
    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void registersAndCreatesAnOwnedBugReport() throws Exception {
        var csrfResult = mvc.perform(get("/api/v1/auth/csrf"))
            .andExpect(status().isOk())
            .andReturn();
        var csrf = objectMapper.readTree(csrfResult.getResponse().getContentAsString()).get("token").asText();
        var csrfCookie = csrfResult.getResponse().getCookie("XSRF-TOKEN");

        mvc.perform(post("/api/v1/auth/register")
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"ada@example.test","displayName":"Ada Lovelace","password":"a-secure-test-password"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.password").doesNotExist());

        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"ADA@example.test","password":"a-secure-test-password"}
                    """))
            .andExpect(status().isOk())
            .andReturn();
        var session = (MockHttpSession) login.getRequest().getSession(false);

        mvc.perform(get("/api/v1/auth/me").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("ada@example.test"));

        MvcResult repository = mvc.perform(post("/api/v1/repositories")
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"fullName":"ada/compiler"}
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        JsonNode repositoryBody = objectMapper.readTree(repository.getResponse().getContentAsString());
        String repositoryId = repositoryBody.get("id").asText();

        MvcResult bug = mvc.perform(post("/api/v1/bugs")
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"repositoryId":"%s","title":"Parser rejects valid input","description":"An accepted expression fails to parse.","reproductionSteps":"1. Submit the expression\\n2. Observe the parser error.","severity":"HIGH"}
                    """.formatted(repositoryId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("NEW"))
            .andExpect(jsonPath("$.repositoryName").value("ada/compiler"))
            .andReturn();
        String bugId = objectMapper.readTree(bug.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(get("/api/v1/bugs").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalItems").value(1))
            .andExpect(jsonPath("$.items[0].title").value("Parser rejects valid input"));

        mvc.perform(patch("/api/v1/bugs/{bugId}", bugId)
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"INVESTIGATING"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("INVESTIGATING"));

        mvc.perform(get("/api/v1/dashboard/metrics").session(session))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalReports").value(1))
            .andExpect(jsonPath("$.newReports").value(0))
            .andExpect(jsonPath("$.investigatingReports").value(1))
            .andExpect(jsonPath("$.highPriorityReports").value(1));

        mvc.perform(patch("/api/v1/bugs/{bugId}", bugId)
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"CLOSED"}
                    """))
            .andExpect(status().isOk());

        mvc.perform(patch("/api/v1/bugs/{bugId}", bugId)
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"NEW"}
                    """))
            .andExpect(status().isConflict());

        mvc.perform(post("/api/v1/auth/register")
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"grace@example.test","displayName":"Grace Hopper","password":"another-secure-password"}
                    """))
            .andExpect(status().isCreated());

        MvcResult secondLogin = mvc.perform(post("/api/v1/auth/login")
                .session(session)
                .cookie(csrfCookie)
                .header("X-XSRF-TOKEN", csrf)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"grace@example.test","password":"another-secure-password"}
                    """))
            .andExpect(status().isOk())
            .andReturn();
        var secondSession = (MockHttpSession) secondLogin.getRequest().getSession(false);

        mvc.perform(get("/api/v1/bugs/{bugId}", bugId).session(secondSession))
            .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/repositories").session(secondSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/v1/dashboard/metrics").session(secondSession))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalReports").value(0));
    }

    @Test
    void rejectsBugReportRequestsWithoutAuthentication() throws Exception {
        mvc.perform(get("/api/v1/bugs"))
            .andExpect(status().isUnauthorized());
    }
}
